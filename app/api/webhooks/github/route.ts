import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, extractPRMetadata } from "@/lib/github-client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
      .select("workspace_id")
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
        repo_id: repo.id,
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
