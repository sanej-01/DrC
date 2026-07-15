import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Octokit } from "octokit";
import { routeAndScorePR } from "@/lib/score-router";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const GENERAL_REVIEW_MAX_FILES = 20;
const GENERAL_REVIEW_MAX_BYTES = 60_000;

// Config/secret/build-output files a general code-quality review has no
// business reading, even though they'd technically be "source" in the repo.
const EXCLUDED_PATH_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.git\//,
  /(^|\/)coverage\//,
  /(^|\/)\.next\//,
  /(^|\/)\.vercel\//,
];
const EXCLUDED_FILENAME_PATTERNS = [
  /^\.env/i,
  /\.lock$/i,
  /^package-lock\.json$/i,
  /^yarn\.lock$/i,
  /^pnpm-lock\.yaml$/i,
  /^\.gitignore$/i,
  /^\.gitmodules$/i,
  /\.map$/i,
  /\.min\.(js|css)$/i,
];
const INCLUDED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".sql", ".md"];

function isAnalyzableSourceFile(path: string): boolean {
  if (EXCLUDED_PATH_PATTERNS.some((p) => p.test(path))) return false;
  const filename = path.split("/").pop() || "";
  if (EXCLUDED_FILENAME_PATTERNS.some((p) => p.test(filename))) return false;
  return INCLUDED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Build a pseudo-diff by concatenating a capped selection of the repo's
 * current source files, for the "no PR history" fallback where there's
 * no real diff to score. Reuses the same scoring prompt/rubric as a
 * normal PR review - the LLM just sees file snapshots instead of a diff.
 */
async function buildGeneralReviewContent(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<{ content: string; fileCount: number }> {
  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
  const { data: branch } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: repoInfo.default_branch,
  });

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch.commit.sha,
    recursive: "true",
  });

  const candidates = (tree.tree || []).filter(
    (entry) => entry.type === "blob" && entry.path && isAnalyzableSourceFile(entry.path)
  );

  let totalBytes = 0;
  const sections: string[] = [];
  let fileCount = 0;

  for (const entry of candidates) {
    if (fileCount >= GENERAL_REVIEW_MAX_FILES || totalBytes >= GENERAL_REVIEW_MAX_BYTES) break;
    if (!entry.path || !entry.sha) continue;

    try {
      const { data: blob } = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: entry.sha,
      });
      if (blob.encoding !== "base64") continue;

      const decoded = Buffer.from(blob.content, "base64").toString("utf-8");
      const remaining = GENERAL_REVIEW_MAX_BYTES - totalBytes;
      const truncated = decoded.length > remaining ? decoded.slice(0, remaining) : decoded;

      sections.push(`--- FILE: ${entry.path} ---\n${truncated}`);
      totalBytes += truncated.length;
      fileCount++;
    } catch (blobError) {
      console.warn(`Failed to fetch blob for ${entry.path}:`, blobError);
    }
  }

  return { content: sections.join("\n\n"), fileCount };
}

/**
 * POST /api/manager/score-prs
 * Manual test-only trigger: score every pull_requests row in the
 * workspace that doesn't have a pr_scores row yet.
 *
 * This is a deliberately minimal stand-in for /api/scoring/score-pr,
 * which depends on several tables (scoring_queue, scoring_feedback,
 * scoring_audit, cost-cap/alert tables) that don't exist in the live
 * schema. This route only touches tables that actually exist:
 * pull_requests, pr_scores, repos, github_oauth_tokens.
 *
 * Body: { workspaceId }
 * Safe to click repeatedly - already-scored PRs are skipped, not
 * re-scored or duplicated.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify the calling user's identity and manager/admin role
    const token = authHeader.slice(7);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !member || !["manager", "admin"].includes(member.role)) {
      return NextResponse.json(
        { error: "Only managers and admins can trigger scoring" },
        { status: 403 }
      );
    }

    // Get the workspace's GitHub token (same one the scanner uses)
    const { data: tokenRecord } = await supabase
      .from("github_oauth_tokens")
      .select("access_token")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (!tokenRecord?.access_token) {
      return NextResponse.json(
        { error: "No GitHub token configured for workspace" },
        { status: 400 }
      );
    }

    // All PRs in the workspace
    const { data: prs, error: prsError } = await supabase
      .from("pull_requests")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (prsError || !prs) {
      return NextResponse.json(
        { error: "Failed to fetch pull requests" },
        { status: 500 }
      );
    }

    // Already-scored PR ids, so re-running this skips them instead of
    // erroring or double-scoring. A row with scores but no
    // overall_assessment predates the overall_assessment/feedback
    // columns being added - delete and re-score it so it gets the
    // full analysis instead of leaving it permanently incomplete.
    const { data: existingScores } = await supabase
      .from("pr_scores")
      .select("id, pull_request_id, overall_assessment")
      .in("pull_request_id", prs.map((pr) => pr.id));

    const incompleteScoreIds = (existingScores || [])
      .filter((s) => !s.overall_assessment)
      .map((s) => s.id);

    if (incompleteScoreIds.length > 0) {
      await supabase.from("pr_scores").delete().in("id", incompleteScoreIds);
    }

    const fullyScored = new Set(
      (existingScores || []).filter((s) => s.overall_assessment).map((s) => s.pull_request_id)
    );
    const toScore = prs.filter((pr) => !fullyScored.has(pr.id));

    const octokit = new Octokit({ auth: tokenRecord.access_token });
    const errors: string[] = [];
    let scored = 0;

    for (const pr of toScore) {
      try {
        const { data: repo } = await supabase
          .from("repos")
          .select("owner, name")
          .eq("id", pr.repo_id)
          .single();

        if (!repo) {
          errors.push(`PR #${pr.number}: repo not found for repo_id ${pr.repo_id}`);
          continue;
        }

        const isGeneralReview = pr.pr_node_id?.startsWith("general-review:");
        let diff = "";
        let filesChangedCount = pr.files_changed_count || 0;

        if (isGeneralReview) {
          // No PR/diff exists - review a snapshot of the current source
          // instead (env/config/lockfiles/build output excluded).
          const { content, fileCount } = await buildGeneralReviewContent(
            octokit,
            repo.owner,
            repo.name
          );
          diff = content;
          filesChangedCount = fileCount;

          // The stored PR row was created at scan time with
          // files_changed_count hardcoded to 0 (there's no real diff
          // to measure yet at that point) - now that we know how many
          // files were actually reviewed, correct it so PR Details
          // shows real numbers instead of "0 files".
          await supabase
            .from("pull_requests")
            .update({ files_changed_count: fileCount })
            .eq("id", pr.id);
        } else {
          try {
            const { data } = await octokit.rest.pulls.get({
              owner: repo.owner,
              repo: repo.name,
              pull_number: pr.number,
              mediaType: { format: "diff" },
            });
            diff = data as unknown as string;
          } catch (diffError) {
            console.warn(`Failed to fetch diff for PR #${pr.number}:`, diffError);
            // Continue with empty diff rather than failing the whole PR
          }
        }

        const { result } = await routeAndScorePR(
          pr.number,
          pr.title,
          pr.author_github_handle,
          filesChangedCount,
          pr.additions_count || 0,
          pr.deletions_count || 0,
          diff
        );

        const overallScore = Math.round(
          (result.code_quality +
            (100 - result.bug_risk) +
            result.architecture +
            result.test_coverage) /
            4
        );

        const { error: insertError } = await supabase.from("pr_scores").insert({
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          repo_id: pr.repo_id,
          pull_request_id: pr.id,
          code_quality: result.code_quality,
          bug_risk: result.bug_risk,
          architecture: result.architecture,
          test_coverage: result.test_coverage,
          overall_score: overallScore,
          overall_assessment: result.overall_assessment,
          feedback: result.feedback,
          scored_at: new Date().toISOString(),
        });

        if (insertError) {
          errors.push(`PR #${pr.number}: ${insertError.message}`);
          continue;
        }

        scored++;
      } catch (prError) {
        const message = prError instanceof Error ? prError.message : "Unknown error";
        errors.push(`PR #${pr.number}: ${message}`);
      }
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
      prs_checked: prs.length,
      prs_already_scored: fullyScored.size,
      prs_scored: scored,
      errors,
    });
  } catch (error) {
    console.error("Manual scoring error:", error);
    return NextResponse.json(
      {
        error: "Scoring failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
