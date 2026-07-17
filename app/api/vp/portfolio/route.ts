import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/vp/portfolio?workspace_id=...
 *
 * Director/VP portfolio. Each active repo the signed-in user's workspaces
 * contain is shown as a "team" row — matching the Projects tab on the
 * manager page. Previously grouped by workspace, which collapsed multiple
 * repos in one workspace into a single row.
 */

interface ScoreRow {
  code_quality: number | null;
  bug_risk: number | null;
  architecture: number | null;
  test_coverage: number | null;
  feedback: { type: string }[] | null;
}

interface PrRow {
  id: string;
  merged_at: string | null;
  developer_id: string | null;
  repo_id: string | null;
  workspace_id: string;
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
  return withManagerAuth(request, async (req, { userId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Workspaces this user manages
    const { data: memberships, error: memberError } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId)
      .in("role", ["manager", "admin"]);

    if (memberError || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: "No managed workspaces found" },
        { status: 404 }
      );
    }

    const workspaceIds = memberships.map((m) => m.workspace_id);

    const [{ data: members }, { data: prList }, { data: repoList }] =
      await Promise.all([
        supabase
          .from("workspace_members")
          .select("workspace_id, user_id, role")
          .in("workspace_id", workspaceIds),
        supabase
          .from("pull_requests")
          .select(
            `id, workspace_id, merged_at, developer_id, repo_id,
             pr_scores(code_quality, bug_risk, architecture, test_coverage, feedback)`
          )
          .in("workspace_id", workspaceIds)
          .not("merged_at", "is", null)
          .order("merged_at", { ascending: false })
          .limit(500),
        supabase
          .from("repos")
          .select("id, name, workspace_id")
          .in("workspace_id", workspaceIds)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
      ]);

    const now = Date.now();
    const prs = (prList || []) as unknown as PrRow[];

    // scored PRs for a given repo and time window
    const scoredFor = (repoId: string, days: number) =>
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

    // All scored PRs across all repos (for org KPIs)
    const scoredAll = (days: number) =>
      prs
        .map((pr) => ({
          pr,
          score: Array.isArray(pr.pr_scores) ? pr.pr_scores[0] : pr.pr_scores,
        }))
        .filter(
          (r): r is { pr: PrRow; score: ScoreRow } =>
            !!r.score &&
            !!r.pr.merged_at &&
            now - new Date(r.pr.merged_at).getTime() <= days * DAY_MS
        );

    // ---- Per-repo teams ----
    const repos = repoList || [];
    const teams = repos.map((repo) => {
      const s30 = scoredFor(repo.id, 30).map((r) => r.score);
      const s90 = scoredFor(repo.id, 90).map((r) => r.score);
      const q30 = avg(s30.map(overallOf));
      const q90 = avg(s90.map(overallOf));

      let momentum: "improving" | "steady" | "watch" | "no_data" = "no_data";
      if (q30 !== null && q90 !== null) {
        const diff = q30 - q90;
        momentum = diff > 3 ? "improving" : diff < -3 ? "watch" : "steady";
      }

      // Developer count = unique developer_ids who have PRs in this repo
      const devCount = new Set(
        prs
          .filter((pr) => pr.repo_id === repo.id && pr.developer_id)
          .map((pr) => pr.developer_id)
      ).size;

      return {
        workspace_id: repo.workspace_id,
        name: repo.name,
        quality: q30 !== null ? Math.round(q30) : null,
        bug_risk:
          s30.length > 0
            ? Math.round(avg(s30.map((s) => s.bug_risk || 0))!)
            : null,
        coverage:
          s30.length > 0
            ? Math.round(avg(s30.map((s) => s.test_coverage || 0))!)
            : null,
        momentum,
        pr_count_30d: s30.length,
        developer_count: devCount,
      };
    });

    // ---- Org KPIs ----
    const org30 = scoredAll(30);
    const org90All = scoredAll(90);
    const merged90 = prs.filter(
      (pr) =>
        pr.merged_at && now - new Date(pr.merged_at).getTime() <= 90 * DAY_MS
    );

    const orgQuality = avg(org30.map((r) => overallOf(r.score)));
    const orgQuality90 = avg(org90All.map((r) => overallOf(r.score)));

    const kpis = {
      org_quality: orgQuality !== null ? Math.round(orgQuality) : null,
      org_quality_delta:
        orgQuality !== null && orgQuality90 !== null
          ? Math.round(orgQuality - orgQuality90)
          : null,
      bug_risk:
        org30.length > 0
          ? Math.round(avg(org30.map((r) => r.score.bug_risk || 0))!)
          : null,
      coaching_coverage:
        merged90.length > 0
          ? Math.round((org90All.length / merged90.length) * 100)
          : null,
      active_engineers: new Set(
        merged90.map((pr) => pr.developer_id).filter(Boolean)
      ).size,
      total_teams: teams.length,
      total_engineers: (members || []).filter((m) => m.role === "developer")
        .length,
    };

    // ---- Early warnings (derived heuristics, per repo) ----
    const warnings: {
      icon: string;
      severity: "warning" | "info" | "win";
      title: string;
      description: string;
      workspace_id: string;
    }[] = [];

    for (const t of teams) {
      const repo = repos.find((r) => r.name === t.name);
      if (!repo) continue;
      const s90 = scoredFor(repo.id, 90).map((r) => r.score);
      const q90 = avg(s90.map(overallOf));
      if (t.quality !== null && q90 !== null && t.quality < q90 - 5) {
        warnings.push({
          icon: "⚠️",
          severity: "warning",
          title: `${t.name} — quality regression`,
          description: `Down ${Math.round(q90 - t.quality)} pts vs the 90-day average. Bug-risk trending up.`,
          workspace_id: t.workspace_id,
        });
      }
      if (t.coverage !== null && t.coverage < 50) {
        warnings.push({
          icon: "🧭",
          severity: "info",
          title: `${t.name} — test coverage low`,
          description: `${t.coverage} vs a 70+ target. A testing focus sprint is recommended.`,
          workspace_id: t.workspace_id,
        });
      }
      if (t.quality !== null && t.quality >= 85) {
        warnings.push({
          icon: "🏆",
          severity: "win",
          title: `${t.name} — best-in-org quality`,
          description: `Sustained ${t.quality} this period. Worth sharing their practices.`,
          workspace_id: t.workspace_id,
        });
      }
      if (t.pr_count_30d === 0) {
        warnings.push({
          icon: "🧭",
          severity: "info",
          title: `${t.name} — no scored PRs in 30 days`,
          description: `No coaching signal this period. Check repo connections and scanning.`,
          workspace_id: t.workspace_id,
        });
      }
    }

    // ---- Trend: 6 x 15-day buckets over last 90 days (org-wide) ----
    const trend = Array.from({ length: 6 }, (_, i) => {
      const bucketEnd = now - (5 - i) * 15 * DAY_MS;
      const bucketStart = bucketEnd - 15 * DAY_MS;
      const inBucket = prs
        .map((pr) => ({
          pr,
          score: Array.isArray(pr.pr_scores) ? pr.pr_scores[0] : pr.pr_scores,
        }))
        .filter(
          (r) =>
            r.pr.merged_at &&
            new Date(r.pr.merged_at).getTime() > bucketStart &&
            new Date(r.pr.merged_at).getTime() <= bucketEnd
        );
      const scored = inBucket.filter((r) => !!r.score);
      const q = avg(scored.map((r) => overallOf(r.score!)));
      const br = avg(scored.map((r) => r.score!.bug_risk || 0));
      return {
        label: `P${i + 1}`,
        quality: q !== null ? Math.round(q) : null,
        bug_risk: br !== null ? Math.round(br) : null,
        coverage:
          inBucket.length > 0
            ? Math.round((scored.length / inBucket.length) * 100)
            : null,
      };
    });

    // ---- Outcome tiles ----
    const devIds = [
      ...new Set(org90All.map((r) => r.pr.developer_id).filter(Boolean)),
    ] as string[];
    let improving = 0;
    for (const dev of devIds) {
      const d30 = avg(
        org30.filter((r) => r.pr.developer_id === dev).map((r) => overallOf(r.score))
      );
      const d90 = avg(
        org90All
          .filter((r) => r.pr.developer_id === dev)
          .map((r) => overallOf(r.score))
      );
      if (d30 !== null && d90 !== null && d30 >= d90) improving++;
    }
    const coachingItems = org90All.reduce(
      (n, r) => n + (r.score.feedback || []).length,
      0
    );

    const outcomes = {
      devs_improving_pct:
        devIds.length > 0 ? Math.round((improving / devIds.length) * 100) : null,
      coaching_items_90d: coachingItems,
      prs_scored_90d: org90All.length,
    };

    return NextResponse.json({ kpis, teams, warnings, trend, outcomes });
  });
}
