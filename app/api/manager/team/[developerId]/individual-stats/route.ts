import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

interface FeedbackItem {
  type: "GOOD" | "IMPROVE" | "FIX" | "SUGGEST";
}

interface ScoreRow {
  code_quality: number | null;
  bug_risk: number | null;
  architecture: number | null;
  test_coverage: number | null;
  feedback: FeedbackItem[] | null;
}

interface PrRow {
  id: string;
  number: number;
  title: string;
  merged_at: string;
  pr_scores: ScoreRow[] | ScoreRow | null;
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

function calculateTrend(
  score90d: number | null,
  score30d: number | null
): "improving" | "declining" | "stable" {
  if (score90d === null || score30d === null) return "stable";
  const diff = score30d - score90d;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

function averageWindow(scores: ScoreRow[]) {
  if (scores.length === 0) {
    return { quality: null, risk: null, architecture: null, tests: null };
  }
  const avg = (key: keyof ScoreRow) =>
    scores.reduce((sum, s) => sum + ((s[key] as number) || 0), 0) / scores.length;
  return {
    quality: avg("code_quality"),
    risk: avg("bug_risk"),
    architecture: avg("architecture"),
    tests: avg("test_coverage"),
  };
}

/**
 * GET /api/manager/team/[developerId]/individual-stats
 * Detailed stats for a single developer, rewritten against the live
 * schema (workspace_members/pull_requests/pr_scores) - the original
 * version referenced tables that were never created (users,
 * pr_aggregates, coaching_cards, pull_requests.repository_id/pr_number),
 * so this page always 404'd/500'd. There's no separate aggregates or
 * coaching_cards table live, so 30/60/90-day windows are computed here
 * from pull_requests + pr_scores directly, and "coaching" is derived
 * from the feedback JSONB already stored per pr_scores row (the same
 * GOOD/IMPROVE/FIX/SUGGEST items PR Details shows).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { developerId } = await params;

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("user_id, github_handle, display_name")
      .eq("workspace_id", workspaceId)
      .eq("user_id", developerId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Developer not found in this workspace" },
        { status: 404 }
      );
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(developerId);

    const { data: pullRequests, error: prError } = await supabase
      .from("pull_requests")
      .select(
        `
        id,
        number,
        title,
        merged_at,
        pr_scores (code_quality, bug_risk, architecture, test_coverage, feedback)
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId)
      .order("merged_at", { ascending: false })
      .limit(50);

    if (prError) {
      return NextResponse.json(
        { error: "Failed to fetch PRs" },
        { status: 500 }
      );
    }

    const rows = (pullRequests || []) as unknown as PrRow[];
    const now = Date.now();
    const withScores = rows
      .map((pr) => ({
        pr,
        score: Array.isArray(pr.pr_scores) ? pr.pr_scores[0] : pr.pr_scores,
      }))
      .filter((r): r is { pr: PrRow; score: ScoreRow } => !!r.score);

    const windowScores = (days: number) =>
      withScores
        .filter((r) => now - new Date(r.pr.merged_at).getTime() <= days * 24 * 60 * 60 * 1000)
        .map((r) => r.score);

    const scores30 = windowScores(30);
    const scores60 = windowScores(60);
    const scores90 = windowScores(90);

    const avg30 = averageWindow(scores30);
    const avg60 = averageWindow(scores60);
    const avg90 = averageWindow(scores90);

    const score_30d = scores30.length > 0 ? calculateOverallScore(avg30) : null;
    const score_60d = scores60.length > 0 ? calculateOverallScore(avg60) : null;
    const score_90d = scores90.length > 0 ? calculateOverallScore(avg90) : null;

    const trajectory = {
      score_90d,
      score_60d,
      score_30d,
      pr_count_90d: scores90.length,
      pr_count_60d: scores60.length,
      pr_count_30d: scores30.length,
      trend: calculateTrend(score_90d, score_30d),
    };

    // Coaching breakdown from the feedback JSONB already attached to
    // every scored PR (last 90 days), instead of a separate table.
    const feedbackItems = withScores
      .filter((r) => now - new Date(r.pr.merged_at).getTime() <= 90 * 24 * 60 * 60 * 1000)
      .flatMap((r) => r.score.feedback || []);

    const coachingBreakdown = {
      GOOD: feedbackItems.filter((f) => f.type === "GOOD").length,
      IMPROVE: feedbackItems.filter((f) => f.type === "IMPROVE").length,
      FIX: feedbackItems.filter((f) => f.type === "FIX").length,
      SUGGEST: feedbackItems.filter((f) => f.type === "SUGGEST").length,
    };

    const recent_prs = withScores.slice(0, 20).map(({ pr, score }) => ({
      id: pr.id,
      pr_number: pr.number,
      title: pr.title,
      merged_at: pr.merged_at,
      score: calculateOverallScore({
        quality: score.code_quality,
        risk: score.bug_risk,
        architecture: score.architecture,
        tests: score.test_coverage,
      }),
      dimensions: {
        quality: score.code_quality,
        bug_risk: score.bug_risk,
        architecture: score.architecture,
        tests: score.test_coverage,
      },
    }));

    const confidenceFor = (count: number) =>
      count >= 3 ? "CONFIDENT" : "LOW_CONFIDENCE";

    // 30-day dimension averages (same formula as /dashboard)
    const dimensions_30d = {
      code_quality: avg30.quality,
      bug_risk: avg30.risk,
      architecture: avg30.architecture,
      test_coverage: avg30.tests,
    };

    // Actionable feedback items from last 90 days (non-GOOD only),
    // each annotated with the PR number they came from.
    const quest_items = withScores
      .filter((r) => now - new Date(r.pr.merged_at).getTime() <= 90 * 24 * 60 * 60 * 1000)
      .flatMap(({ pr, score }) =>
        (score.feedback || [])
          .filter((f) => f.type !== "GOOD")
          .map((f, i) => ({
            id: `${pr.id}-${i}`,
            type: f.type,
            title: (f as any).title || "",
            description: (f as any).description || "",
            dimension: (f as any).dimension || null,
            pr_number: pr.number,
          }))
      )
      .slice(0, 3);

    // Latest coaching: most recent scored PR's overall_assessment + lead feedback
    const latestScored = withScores[0];
    const latest_coaching = latestScored
      ? (() => {
          const fb = latestScored.score.feedback || [];
          const lead = fb.find((f) => f.type !== "GOOD") || fb[0];
          return {
            pr_number: latestScored.pr.number,
            pr_title: latestScored.pr.title,
            headline:
              (lead as any)?.title ||
              (latestScored.score as any).overall_assessment ||
              "Reviewed — nothing urgent flagged",
            tag: (lead as any)?.dimension || null,
            body:
              (latestScored.score as any).overall_assessment ||
              (lead as any)?.description ||
              "No detailed notes for this PR.",
          };
        })()
      : null;

    return NextResponse.json({
      developer: {
        id: developerId,
        display_name: member.display_name || authUser?.user?.email || "Unknown",
        email: authUser?.user?.email || "",
        github_handle: member.github_handle || undefined,
      },
      trajectory,
      coaching: {
        total: feedbackItems.length,
        breakdown: coachingBreakdown,
      },
      recent_prs,
      aggregates: {
        confidence_30d: confidenceFor(scores30.length),
        confidence_60d: confidenceFor(scores60.length),
        confidence_90d: confidenceFor(scores90.length),
      },
      dimensions_30d,
      quest_items,
      latest_coaching,
    });
  });
}
