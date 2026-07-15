import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Octokit } from "octokit";
import { routeAndScorePR } from "@/lib/score-router";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

        let diff = "";
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

        const { result } = await routeAndScorePR(
          pr.number,
          pr.title,
          pr.author_github_handle,
          pr.files_changed_count || 0,
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
