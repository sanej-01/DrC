import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, extractPRMetadata, getPRDiff } from "@/lib/github-client";
import { checkSkipScoring, checkLargePR, recordAlert, recordFileDisclosure } from "@/lib/guards";
import { scanDiffForSecrets, redactSecretsFromDiff, recordSecretAlert } from "@/lib/secret-scanner";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Parse unified diff to extract file paths and change counts
 * Returns files with included/omitted status (first N files included, rest omitted)
 */
function parseDiffForFiles(
  diff: string,
  scoreLimit: number
): Array<{
  path: string;
  additions: number;
  deletions: number;
  included: boolean;
}> {
  const files = new Map<
    string,
    { additions: number; deletions: number }
  >();

  // Parse unified diff format
  // Lines starting with "diff --git a/path/to/file b/path/to/file"
  const lines = diff.split("\n");
  let currentFile = "";

  for (const line of lines) {
    // File header: "diff --git a/path/to/file b/path/to/file"
    if (line.startsWith("diff --git")) {
      const match = line.match(/^diff --git a\/(.*) b\/(.*)/);
      if (match) {
        currentFile = match[1]; // Use a/ path
        files.set(currentFile, { additions: 0, deletions: 0 });
      }
    }

    // Count additions and deletions
    if (currentFile) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        files.get(currentFile)!.additions++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        files.get(currentFile)!.deletions++;
      }
    }
  }

  // Convert to array, mark which files are included vs omitted
  const result: Array<{
    path: string;
    additions: number;
    deletions: number;
    included: boolean;
  }> = [];

  let fileIndex = 0;
  for (const [path, { additions, deletions }] of files) {
    result.push({
      path,
      additions,
      deletions,
      included: fileIndex < scoreLimit,
    });
    fileIndex++;
  }

  return result;
}

/**
 * POST /api/webhooks/github
 * GitHub webhook receiver for PR events
 * TC-ING-001: Valid pull_request.closed(merged=true) → 200, enqueued
 * TC-ING-002: Bad HMAC signature → 401, not enqueued, security log
 * TC-ING-007: Draft/synchronize (non-merged) → validated but not scored
 * TC-EDG-009: Empty PR → scoring skipped gracefully
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get signature from header
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      // Log security event
      await supabase.from("audit_log").insert({
        action: "webhook_invalid_signature",
        subject_type: "webhook",
        subject_id: "github",
        details: { reason: "missing_signature", endpoint: request.nextUrl.pathname },
      });

      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Read body for signature verification
    const body = await request.text();

    // Verify webhook signature (TC-ING-002)
    if (!verifyWebhookSignature(body, signature)) {
      // Log security event
      await supabase.from("audit_log").insert({
        action: "webhook_bad_signature",
        subject_type: "webhook",
        subject_id: "github",
        details: {
          reason: "hmac_mismatch",
          endpoint: request.nextUrl.pathname,
        },
      });

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Verify it's a pull_request event
    if (payload.action !== "closed") {
      // Draft, opened, synchronize, etc. — validated but not scored (TC-ING-007)
      await supabase.from("audit_log").insert({
        action: "webhook_ignored_event",
        subject_type: "webhook",
        subject_id: payload.pull_request?.node_id || "unknown",
        details: {
          action: payload.action,
          merged: payload.pull_request?.merged,
        },
      });

      return NextResponse.json({ status: "ignored", reason: "not_merged" });
    }

    // Extract PR metadata
    const prMetadata = extractPRMetadata(payload);
    if (!prMetadata) {
      // Not merged or invalid
      return NextResponse.json({ status: "ignored", reason: "not_merged" });
    }

    // Check for empty diff (TC-EDG-009)
    const filesChanged = prMetadata.files_changed;
    if (filesChanged === 0) {
      // Skip scoring for empty PRs
      await supabase.from("audit_log").insert({
        workspace_id: "unknown", // Will be resolved during processing
        action: "webhook_empty_pr",
        subject_type: "pr",
        subject_id: prMetadata.pr_node_id,
        details: {
          pr_number: prMetadata.pr_number,
          reason: "no_files_changed",
        },
      });

      return NextResponse.json({
        status: "enqueued",
        reason: "empty_pr_skipped",
      });
    }

    // Find workspace by repo
    const { data: repo } = await supabase
      .from("repos")
      .select("workspace_id, repo_id")
      .eq("full_name", `${prMetadata.repo_owner}/${prMetadata.repo_name}`)
      .single();

    if (!repo) {
      // Repo not linked to any workspace
      await supabase.from("audit_log").insert({
        action: "webhook_repo_not_linked",
        subject_type: "pr",
        subject_id: prMetadata.pr_node_id,
        details: {
          repo: `${prMetadata.repo_owner}/${prMetadata.repo_name}`,
        },
      });

      return NextResponse.json({
        status: "ignored",
        reason: "repo_not_linked",
      });
    }

    // Check for duplicate (dedup by pr_node_id) - TC-ING-003
    const { data: existing } = await supabase
      .from("pull_requests")
      .select("id")
      .eq("pr_node_id", prMetadata.pr_node_id)
      .single();

    if (existing) {
      // Already processed
      return NextResponse.json({
        status: "ignored",
        reason: "duplicate_pr_node_id",
      });
    }

    // Insert PR into database (metadata only, no diff) - TC-ING-001
    const { data: pr, error: insertError } = await supabase
      .from("pull_requests")
      .insert({
        workspace_id: repo.workspace_id,
        repo_id: repo.repo_id,
        github_pr_id: prMetadata.github_pr_id,
        pr_node_id: prMetadata.pr_node_id,
        title: prMetadata.title,
        number: prMetadata.pr_number,
        url: prMetadata.url,
        author_github_handle: prMetadata.author_github_handle,
        merged_at: prMetadata.merged_at,
        additions_count: prMetadata.additions,
        deletions_count: prMetadata.deletions,
        files_changed_count: prMetadata.files_changed,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting PR:", insertError);
      return NextResponse.json(
        { error: "Failed to enqueue PR" },
        { status: 500 }
      );
    }

    // Log audit entry
    await supabase.from("audit_log").insert({
      workspace_id: repo.workspace_id,
      action: "pr_enqueued",
      subject_type: "pr",
      subject_id: prMetadata.pr_node_id,
      details: {
        pr_number: prMetadata.pr_number,
        additions: prMetadata.additions,
        deletions: prMetadata.deletions,
        files_changed: prMetadata.files_changed,
      },
    });

    // ============ PHASE 3.7 SECRET SCANNING ============
    // ============ PHASE 3.6 GUARDS ============
    // Check for secrets, guards, and disclosures (async, don't block response)
    (async () => {
      try {
        let diffContent = "";

        // Fetch diff for scanning (needed for secrets, large PR disclosure)
        // Only fetch if files_changed > 0 (optimization)
        if (prMetadata.files_changed > 0) {
          try {
            diffContent = await getPRDiff(
              prMetadata.repo_owner,
              prMetadata.repo_name,
              prMetadata.pr_number
            );
          } catch (diffError) {
            console.warn("Failed to fetch diff for scanning:", diffError);
            // Continue anyway — lack of diff doesn't block processing
          }
        }

        // ============ PHASE 3.7: SECRET REDACTION ============
        // Scan diff for secrets before any processing
        if (diffContent) {
          const secretFindings = scanDiffForSecrets(diffContent);

          if (secretFindings.length > 0) {
            // Log security alert
            await recordSecretAlert(
              repo.workspace_id,
              pr.id,
              secretFindings,
              prMetadata.pr_number,
              prMetadata.author_github_handle
            );

            // Redact secrets from diff (for file-level disclosure, don't expose actual secrets)
            diffContent = redactSecretsFromDiff(diffContent);
          }
        }

        // ============ PHASE 3.6: GUARDS ============
        // Check if should skip scoring (empty diff, draft)
        const skipResult = await checkSkipScoring(
          pr.id,
          prMetadata.files_changed,
          false // Not draft (webhook only fires for merged)
        );

        if (skipResult.should_alert && skipResult.alert_type) {
          await recordAlert(
            repo.workspace_id,
            pr.id,
            skipResult.alert_type,
            "warning",
            skipResult.alert_message || "Scoring skipped",
            skipResult.details
          );
        }

        // Check if large PR
        const largeResult = await checkLargePR(
          pr.id,
          prMetadata.files_changed,
          prMetadata.additions,
          prMetadata.deletions
        );

        if (largeResult.should_alert && largeResult.alert_type) {
          await recordAlert(
            repo.workspace_id,
            pr.id,
            largeResult.alert_type,
            "warning",
            largeResult.alert_message || "Large PR detected",
            largeResult.details
          );

          // For large PRs, record file-level disclosure
          if (diffContent) {
            // Parse diff to extract file paths and changes (uses redacted diff)
            const files = parseDiffForFiles(diffContent, 200); // Only track first 200 files
            await recordFileDisclosure(pr.id, files);
          }
        }
      } catch (processingError) {
        console.error("Error in secret scanning and guards:", processingError);
        // Don't fail the webhook — scanning/guards are best-effort
      }
    })();

    // Return 200 immediately (fast response) - TC-ING-001
    return NextResponse.json(
      { status: "enqueued", pr_id: pr.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
