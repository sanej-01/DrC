import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/team/[developerId]/individual-stats
 * Returns detailed stats for a single developer (Phase 6.2)
 * Query params: workspaceId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { developerId: string } }
) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const developerId = params.developerId;

    // Fetch developer info
    const { data: developer, error: devError } = await supabase
      .from("users")
      .select("*")
      .eq("id", developerId)
      .single();

    if (devError) {
      return NextResponse.json(
        { error: "Developer not found" },
        { status: 404 }
      );
    }

    // Fetch aggregates (30/60/90-day)
    const { data: aggregates, error: aggError } = await supabase
      .from("pr_aggregates")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId)
      .single();

    if (aggError && aggError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch aggregates" },
        { status: 500 }
      );
    }

    // Fetch recent PRs (last 20)
    const { data: pullRequests, error: prError } = await supabase
      .from("pull_requests")
      .select(
        `
        id,
        pr_number,
        title,
        merged_at,
        repository_id,
        pr_scores (
          code_quality,
          bug_risk,
          architecture,
          test_coverage,
          created_at
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId)
      .order("merged_at", { ascending: false })
      .limit(20);

    if (prError) {
      return NextResponse.json(
        { error: "Failed to fetch PRs" },
        { status: 500 }
      );
    }

    // Fetch coaching cards for this developer (from their PRs)
    const prIds = (pullRequests || []).map((pr: any) => pr.id);
    const { data: coachingCards, error: coachError } = await supabase
      .from("coaching_cards")
      .select("*")
      .in("pr_id", prIds.length > 0 ? prIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (coachError) {
      return NextResponse.json(
        { error: "Failed to fetch coaching cards" },
        { status: 500 }
      );
    }

    // Calculate 90-day trajectory points (using aggregates)
    const trajectory = {
      score_90d: aggregates
        ? calculateOverallScore({
            quality: aggregates.avg_code_quality_90d,
            risk: aggregates.avg_bug_risk_90d,
            architecture: aggregates.avg_architecture_90d,
            tests: aggregates.avg_test_coverage_90d,
          })
        : null,
      score_60d: aggregates
        ? calculateOverallScore({
            quality: aggregates.avg_code_quality_60d,
            risk: aggregates.avg_bug_risk_60d,
            architecture: aggregates.avg_architecture_60d,
            tests: aggregates.avg_test_coverage_60d,
          })
        : null,
      score_30d: aggregates
        ? calculateOverallScore({
            quality: aggregates.avg_code_quality_30d,
            risk: aggregates.avg_bug_risk_30d,
            architecture: aggregates.avg_architecture_30d,
            tests: aggregates.avg_test_coverage_30d,
          })
        : null,
      pr_count_90d: aggregates?.score_count_90d || 0,
      pr_count_60d: aggregates?.score_count_60d || 0,
      pr_count_30d: aggregates?.score_count_30d || 0,
      trend: calculateTrend(
        aggregates?.avg_code_quality_90d,
        aggregates?.avg_code_quality_30d
      ),
    };

    // Coaching breakdown by severity
    const coachingBreakdown = {
      GOOD: (coachingCards || []).filter((c: any) => c.severity === "GOOD")
        .length,
      IMPROVE: (coachingCards || []).filter((c: any) => c.severity === "IMPROVE")
        .length,
      FIX: (coachingCards || []).filter((c: any) => c.severity === "FIX")
        .length,
      SUGGEST: (coachingCards || []).filter((c: any) => c.severity === "SUGGEST")
        .length,
    };

    // PR heat map (recent PRs with scores)
    const prHeat = (pullRequests || []).map((pr: any) => ({
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      merged_at: pr.merged_at,
      score: pr.pr_scores?.[0]
        ? calculateOverallScore({
            quality: pr.pr_scores[0].code_quality,
            risk: pr.pr_scores[0].bug_risk,
            architecture: pr.pr_scores[0].architecture,
            tests: pr.pr_scores[0].test_coverage,
          })
        : null,
      dimensions: pr.pr_scores?.[0]
        ? {
            quality: pr.pr_scores[0].code_quality,
            bug_risk: pr.pr_scores[0].bug_risk,
            architecture: pr.pr_scores[0].architecture,
            tests: pr.pr_scores[0].test_coverage,
          }
        : null,
    }));

    return NextResponse.json({
      developer,
      trajectory,
      coaching: {
        total: (coachingCards || []).length,
        breakdown: coachingBreakdown,
      },
      recent_prs: prHeat,
      aggregates: aggregates
        ? {
            confidence_30d: aggregates.confidence_badge_30d,
            confidence_60d: aggregates.confidence_badge_60d,
            confidence_90d: aggregates.confidence_badge_90d,
          }
        : null,
    });
  });
}

function calculateOverallScore(dims: {
  quality: number | null;
  risk: number | null;
  architecture: number | null;
  tests: number | null;
}): number {
  const quality = dims.quality || 0;
  const riskInverted = 100 - (dims.risk || 0);
  const architecture = dims.architecture || 0;
  const tests = dims.tests || 0;
  return Math.round((quality + riskInverted + architecture + tests) / 4);
}

function calculateTrend(score90d: number | null, score30d: number | null): string {
  if (!score90d || !score30d) return "neutral";
  const diff = score30d - score90d;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}
