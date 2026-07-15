import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/team/pr-details
 * Returns every pull request in the workspace with its score
 * breakdown and the LLM's written analysis/feedback, for display in
 * the Team Garden "PR Details" section.
 * Query params: workspace_id
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data: prs, error: prsError } = await supabase
      .from("pull_requests")
      .select(
        "id, number, title, url, author_github_handle, developer_id, merged_at, additions_count, deletions_count, files_changed_count, pr_scores(code_quality, bug_risk, architecture, test_coverage, overall_score, overall_assessment, feedback, scored_at)"
      )
      .eq("workspace_id", workspaceId)
      .order("merged_at", { ascending: false });

    if (prsError) {
      return NextResponse.json(
        { error: "Failed to fetch PR details" },
        { status: 500 }
      );
    }

    // Author display info for PRs linked to a real developer account
    const developerIds = (prs || [])
      .map((pr) => pr.developer_id)
      .filter((id): id is string => !!id);

    let emailById = new Map<string, string>();
    let displayNameById = new Map<string, string>();
    if (developerIds.length > 0) {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      emailById = new Map(authUsers.users.map((u) => [u.id, u.email || ""]));

      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id, display_name")
        .eq("workspace_id", workspaceId)
        .not("display_name", "is", null);
      displayNameById = new Map(
        (members || []).map((m: { user_id: string; display_name: string }) => [
          m.user_id,
          m.display_name,
        ])
      );
    }

    const details = (prs || []).map((pr) => {
      const score = Array.isArray(pr.pr_scores) ? pr.pr_scores[0] : pr.pr_scores;
      const authorDisplayName = pr.developer_id
        ? displayNameById.get(pr.developer_id) || emailById.get(pr.developer_id) || null
        : null;
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        author_github_handle: pr.author_github_handle,
        author_display_name: authorDisplayName,
        merged_at: pr.merged_at,
        additions_count: pr.additions_count,
        deletions_count: pr.deletions_count,
        files_changed_count: pr.files_changed_count,
        score: score
          ? {
              code_quality: score.code_quality,
              bug_risk: score.bug_risk,
              architecture: score.architecture,
              test_coverage: score.test_coverage,
              overall_score: score.overall_score,
              overall_assessment: score.overall_assessment,
              feedback: score.feedback || [],
              scored_at: score.scored_at,
            }
          : null,
      };
    });

    return NextResponse.json({ workspace_id: workspaceId, prs: details });
  });
}
