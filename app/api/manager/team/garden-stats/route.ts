import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/team/garden-stats
 * Returns team member stats for garden visualization (Phase 6.1)
 * Query params: workspaceId, includeZeroPR=false
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const includeZeroPR =
      request.nextUrl.searchParams.get("includeZeroPR") === "true";

    // Fetch team members with their aggregates
    const { data: team, error: teamError } = await supabase
      .from("memberships")
      .select(
        `
        user_id,
        role,
        users:user_id (
          id,
          display_name,
          email,
          github_handle
        ),
        pr_aggregates!inner (
          developer_id,
          avg_code_quality_30d,
          avg_bug_risk_30d,
          avg_architecture_30d,
          avg_test_coverage_30d,
          score_count_30d,
          confidence_badge_30d
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("pr_aggregates.workspace_id", workspaceId);

    if (teamError && teamError.code !== "PGRST116") {
      // PGRST116 = no rows, which is OK
      return NextResponse.json(
        { error: "Failed to fetch team stats" },
        { status: 500 }
      );
    }

    // Get members without pr_aggregates (zero PR contributors)
    const { data: zeroScoreMembers, error: zeroError } = await supabase
      .from("memberships")
      .select(
        `
        user_id,
        role,
        users:user_id (
          id,
          display_name,
          email,
          github_handle
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .not("user_id", "in", `(${(team || []).map((m: any) => `'${m.user_id}'`).join(",")})`);

    if (zeroError && zeroError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch team stats" },
        { status: 500 }
      );
    }

    // Transform team data with garden stage calculation
    const teamWithGarden = (team || []).map((member: any) => {
      const agg = member.pr_aggregates[0];
      const stage = getGardenStage(agg);

      return {
        id: member.user_id,
        display_name: member.users.display_name,
        email: member.users.email,
        github_handle: member.users.github_handle,
        role: member.role,
        stage,
        pr_count: agg.score_count_30d,
        score_30d: calculateOverallScore(agg),
        confidence: agg.confidence_badge_30d,
        dimensions: {
          quality: agg.avg_code_quality_30d,
          bug_risk: agg.avg_bug_risk_30d,
          architecture: agg.avg_architecture_30d,
          tests: agg.avg_test_coverage_30d,
        },
      };
    });

    // Add zero-PR members if includeZeroPR is true
    const zeroMembers = includeZeroPR
      ? (zeroScoreMembers || []).map((member: any) => ({
          id: member.user_id,
          display_name: member.users.display_name,
          email: member.users.email,
          github_handle: member.users.github_handle,
          role: member.role,
          stage: "no_data",
          pr_count: 0,
          score_30d: null,
          confidence: "NO_DATA",
          dimensions: {
            quality: null,
            bug_risk: null,
            architecture: null,
            tests: null,
          },
        }))
      : [];

    const allMembers = [...teamWithGarden, ...zeroMembers];

    // Calculate workspace stats
    const stats = {
      total_members: allMembers.length,
      members_with_data: teamWithGarden.length,
      members_no_data: zeroMembers.length,
      stage_breakdown: {
        flourishing: allMembers.filter((m: any) => m.stage === "flourishing").length,
        mature: allMembers.filter((m: any) => m.stage === "mature").length,
        sapling: allMembers.filter((m: any) => m.stage === "sapling").length,
        seedling: allMembers.filter((m: any) => m.stage === "seedling").length,
        no_data: allMembers.filter((m: any) => m.stage === "no_data").length,
      },
      avg_score_30d:
        teamWithGarden.length > 0
          ? teamWithGarden.reduce(
              (sum: number, m: any) => sum + (m.score_30d || 0),
              0
            ) / teamWithGarden.length
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
function getGardenStage(agg: any): string {
  if (!agg || agg.score_count_30d === 0) return "no_data";
  if (agg.confidence_badge_30d === "LOW_CONFIDENCE") return "seedling";

  const score = calculateOverallScore(agg);
  if (score >= 85) return "flourishing";
  if (score >= 70) return "mature";
  if (score >= 40) return "sapling";
  return "seedling";
}

/**
 * Calculate overall score from 4 dimensions
 * Overall = (quality + (100-risk) + architecture + tests) / 4
 */
function calculateOverallScore(agg: any): number {
  const quality = agg.avg_code_quality_30d || 0;
  const riskInverted = 100 - (agg.avg_bug_risk_30d || 0);
  const architecture = agg.avg_architecture_30d || 0;
  const tests = agg.avg_test_coverage_30d || 0;
  return Math.round((quality + riskInverted + architecture + tests) / 4);
}
