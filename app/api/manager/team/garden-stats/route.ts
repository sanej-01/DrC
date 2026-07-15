import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

const MIN_CONFIDENCE_THRESHOLD = 3; // Need at least 3 PRs for "CONFIDENT"

interface ScoreRow {
  code_quality: number | null;
  bug_risk: number | null;
  architecture: number | null;
  test_coverage: number | null;
}

/**
 * GET /api/manager/team/garden-stats
 * Returns team member stats for garden visualization (Phase 6.1)
 * Query params: workspace_id, includeZeroPR=false
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const includeZeroPR =
      request.nextUrl.searchParams.get("includeZeroPR") === "true";

    // Workspace membership (role, display_name) for every member
    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id, role, display_name")
      .eq("workspace_id", workspaceId);

    if (membersError) {
      return NextResponse.json(
        { error: "Failed to fetch team stats" },
        { status: 500 }
      );
    }

    // Auth user info (email) for each member
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers();
    if (authError) {
      return NextResponse.json(
        { error: "Failed to fetch team stats" },
        { status: 500 }
      );
    }
    const emailById = new Map(authUsers.users.map((u) => [u.id, u.email]));

    // Merged PRs (with scores) in the last 30 days for this workspace
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: prs, error: prError } = await supabase
      .from("pull_requests")
      .select("developer_id, merged_at, pr_scores(code_quality, bug_risk, architecture, test_coverage)")
      .eq("workspace_id", workspaceId)
      .gte("merged_at", thirtyDaysAgo);

    if (prError) {
      return NextResponse.json(
        { error: "Failed to fetch team stats" },
        { status: 500 }
      );
    }

    // Group scores by developer
    const scoresByDeveloper = new Map<string, ScoreRow[]>();
    for (const pr of prs || []) {
      if (!pr.developer_id) continue;
      const scores = Array.isArray(pr.pr_scores) ? pr.pr_scores : [];
      for (const score of scores as ScoreRow[]) {
        const existing = scoresByDeveloper.get(pr.developer_id) || [];
        existing.push(score);
        scoresByDeveloper.set(pr.developer_id, existing);
      }
    }

    const allMembers = (members || [])
      .map((member) => {
        const scores = scoresByDeveloper.get(member.user_id) || [];
        const count = scores.length;

        if (count === 0) {
          return {
            id: member.user_id,
            display_name: emailById.get(member.user_id) || "Unknown",
            email: emailById.get(member.user_id) || "",
            role: member.role,
            stage: "no_data" as const,
            pr_count: 0,
            score_30d: null,
            confidence: "LOW_CONFIDENCE",
            dimensions: {
              quality: null,
              bug_risk: null,
              architecture: null,
              tests: null,
            },
          };
        }

        const avg = (key: keyof ScoreRow) =>
          Math.round(
            (scores.reduce((sum, s) => sum + (s[key] || 0), 0) / count) * 100
          ) / 100;

        const dims = {
          quality: avg("code_quality"),
          bug_risk: avg("bug_risk"),
          architecture: avg("architecture"),
          tests: avg("test_coverage"),
        };

        const score_30d = Math.round(
          (dims.quality + (100 - dims.bug_risk) + dims.architecture + dims.tests) / 4
        );

        const confidence =
          count >= MIN_CONFIDENCE_THRESHOLD ? "CONFIDENT" : "LOW_CONFIDENCE";

        return {
          id: member.user_id,
          display_name: member.display_name || emailById.get(member.user_id) || "Unknown",
          email: emailById.get(member.user_id) || "",
          role: member.role,
          stage: getGardenStage(score_30d, confidence),
          pr_count: count,
          score_30d,
          confidence,
          dimensions: dims,
        };
      })
      .filter((m) => includeZeroPR || m.pr_count > 0);

    const membersWithData = allMembers.filter((m) => m.pr_count > 0);

    const stats = {
      total_members: allMembers.length,
      members_with_data: membersWithData.length,
      members_no_data: allMembers.length - membersWithData.length,
      stage_breakdown: {
        flourishing: allMembers.filter((m) => m.stage === "flourishing").length,
        mature: allMembers.filter((m) => m.stage === "mature").length,
        sapling: allMembers.filter((m) => m.stage === "sapling").length,
        seedling: allMembers.filter((m) => m.stage === "seedling").length,
        no_data: allMembers.filter((m) => m.stage === "no_data").length,
      },
      avg_score_30d:
        membersWithData.length > 0
          ? membersWithData.reduce((sum, m) => sum + (m.score_30d || 0), 0) /
            membersWithData.length
          : null,
    };

    return NextResponse.json({ members: allMembers, stats });
  });
}

/**
 * Determine garden stage based on 30-day aggregate score
 * - flourishing: 85+ score
 * - mature: 70-84 score
 * - sapling: 40-69 score
 * - seedling: <40 or low confidence (<3 PRs)
 */
function getGardenStage(
  score: number,
  confidence: string
): "flourishing" | "mature" | "sapling" | "seedling" | "no_data" {
  if (confidence === "LOW_CONFIDENCE") return "seedling";
  if (score >= 85) return "flourishing";
  if (score >= 70) return "mature";
  if (score >= 40) return "sapling";
  return "seedling";
}
