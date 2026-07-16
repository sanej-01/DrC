import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/projects?workspace_id=...
 *
 * Projects view for the manager page: quality rolled up per connected
 * repo across all contributors. There is no separate projects table in
 * the live schema — each row in `repos` is a project, and everything is
 * computed on the fly from pull_requests (repo_id) + pr_scores:
 * - quality: avg overall score of PRs merged in the last 30 days
 * - open_issues: FIX feedback items on those PRs (best live proxy)
 * - momentum: 30-day vs 90-day quality (±3 pts)
 * - trend: six 15-day "release" buckets with quality + bug-risk
 */

interface FeedbackItem {
  type: string;
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
  repo_id: string | null;
  merged_at: string | null;
  pr_scores: ScoreRow[] | ScoreRow | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function overallOf(s: ScoreRow): number {
  return (
    ((s.code_quality || 0) +
      (100 - (s.bug_risk || 0)) +
      (s.architecture || 0) +
      (s.test_coverage || 0)) /
    4
  );
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const [{ data: repos, error: repoError }, { data: prList, error: prError }] =
      await Promise.all([
        supabase
          .from("repos")
          .select("id, name, full_name")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true),
        supabase
          .from("pull_requests")
          .select(
            `id, repo_id, merged_at,
             pr_scores(code_quality, bug_risk, architecture, test_coverage, feedback)`
          )
          .eq("workspace_id", workspaceId)
          .not("merged_at", "is", null)
          .order("merged_at", { ascending: false })
          .limit(500),
      ]);

    if (repoError || prError) {
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    const now = Date.now();
    const prs = (prList || []) as unknown as PrRow[];

    const scoredOf = (repoId: string, days: number) =>
      prs
        .map((pr) => ({
          pr,
          score: Array.isArray(pr.pr_scores) ? pr.pr_scores[0] : pr.pr_scores,
        }))
        .filter(
          (r): r is { pr: PrRow; score: ScoreRow } =>
            !!r.score &&
            r.pr.repo_id === repoId &&
            !!r.pr.merged_at &&
            now - new Date(r.pr.merged_at).getTime() <= days * DAY_MS
        );

    const projects = (repos || []).map((repo) => {
      const s30 = scoredOf(repo.id, 30);
      const s90 = scoredOf(repo.id, 90);
      const q30 = avg(s30.map((r) => overallOf(r.score)));
      const q90 = avg(s90.map((r) => overallOf(r.score)));

      let momentum: "improving" | "steady" | "watch" | "no_data" = "no_data";
      if (q30 !== null && q90 !== null) {
        const diff = q30 - q90;
        momentum = diff > 3 ? "improving" : diff < -3 ? "watch" : "steady";
      }

      const openIssues = s30.reduce(
        (n, r) =>
          n + (r.score.feedback || []).filter((f) => f.type === "FIX").length,
        0
      );

      // Release-over-release: six 15-day buckets over the last 90 days
      const trend = Array.from({ length: 6 }, (_, i) => {
        const bucketEnd = now - (5 - i) * 15 * DAY_MS;
        const bucketStart = bucketEnd - 15 * DAY_MS;
        const inBucket = prs
          .map((pr) => ({
            pr,
            score: Array.isArray(pr.pr_scores) ? pr.pr_scores[0] : pr.pr_scores,
          }))
          .filter(
            (r): r is { pr: PrRow; score: ScoreRow } =>
              !!r.score &&
              r.pr.repo_id === repo.id &&
              !!r.pr.merged_at &&
              new Date(r.pr.merged_at!).getTime() > bucketStart &&
              new Date(r.pr.merged_at!).getTime() <= bucketEnd
          );
        const q = avg(inBucket.map((r) => overallOf(r.score)));
        const br = avg(inBucket.map((r) => r.score.bug_risk || 0));
        return {
          label: `R${i + 1}`,
          quality: q !== null ? Math.round(q) : null,
          bug_risk: br !== null ? Math.round(br) : null,
        };
      });

      return {
        repo_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        quality: q30 !== null ? Math.round(q30) : null,
        open_issues: openIssues,
        momentum,
        pr_count_30d: s30.length,
        trend,
      };
    });

    return NextResponse.json({ projects });
  });
}
