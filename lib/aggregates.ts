/**
 * Aggregates — Phase 4.4
 * Compute rolling 30/60/90-day averages for developers
 * Track confidence badges (LOW_CONFIDENCE if < 3 PRs)
 */

import { createClient } from "@supabase/supabase-js";

export interface AggregateWindow {
  days: 30 | 60 | 90;
  avg_code_quality: number | null;
  avg_bug_risk: number | null;
  avg_architecture: number | null;
  avg_test_coverage: number | null;
  score_count: number;
  confidence_badge: "LOW_CONFIDENCE" | "CONFIDENT";
}

export interface DeveloperAggregate {
  developer_id: string;
  workspace_id: string;
  window_30d: AggregateWindow;
  window_60d: AggregateWindow;
  window_90d: AggregateWindow;
  last_computed_at: string;
}

const MIN_CONFIDENCE_THRESHOLD = 3; // Need at least 3 PRs for "CONFIDENT"

/**
 * Compute aggregates for a single developer in a workspace
 * Fetches PR scores from past N days, computes rolling averages
 */
export async function computeDeveloperAggregates(
  supabase: any,
  workspace_id: string,
  developer_id: string
): Promise<DeveloperAggregate> {
  const now = new Date();
  const windows = [30, 60, 90] as const;

  const aggregates: Record<30 | 60 | 90, AggregateWindow> = {
    30: { days: 30, avg_code_quality: null, avg_bug_risk: null, avg_architecture: null, avg_test_coverage: null, score_count: 0, confidence_badge: "LOW_CONFIDENCE" },
    60: { days: 60, avg_code_quality: null, avg_bug_risk: null, avg_architecture: null, avg_test_coverage: null, score_count: 0, confidence_badge: "LOW_CONFIDENCE" },
    90: { days: 90, avg_code_quality: null, avg_bug_risk: null, avg_architecture: null, avg_test_coverage: null, score_count: 0, confidence_badge: "LOW_CONFIDENCE" },
  };

  for (const days of windows) {
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all PRs authored by developer in workspace, scored within window
    const { data: scores, error } = await supabase
      .from("pr_scores")
      .select(
        `
        code_quality,
        bug_risk,
        architecture,
        test_coverage,
        pull_requests!inner(author_id, workspace_id)
      `
      )
      .eq("pull_requests.workspace_id", workspace_id)
      .eq("pull_requests.author_id", developer_id)
      .gte("scored_at", cutoffDate)
      .order("scored_at", { ascending: false });

    if (error) {
      console.error(`Error fetching scores for ${days}d window:`, error);
      continue;
    }

    if (scores && scores.length > 0) {
      const count = scores.length;
      type ScoreTotals = {
        code_quality: number;
        bug_risk: number;
        architecture: number;
        test_coverage: number;
      };

      const sum = scores.reduce(
        (acc: ScoreTotals, score: Partial<ScoreTotals>): ScoreTotals => ({
          code_quality: acc.code_quality + (score.code_quality || 0),
          bug_risk: acc.bug_risk + (score.bug_risk || 0),
          architecture: acc.architecture + (score.architecture || 0),
          test_coverage: acc.test_coverage + (score.test_coverage || 0),
        }),
        { code_quality: 0, bug_risk: 0, architecture: 0, test_coverage: 0 }
      );

      aggregates[days] = {
        days,
        avg_code_quality: Math.round((sum.code_quality / count) * 100) / 100,
        avg_bug_risk: Math.round((sum.bug_risk / count) * 100) / 100,
        avg_architecture: Math.round((sum.architecture / count) * 100) / 100,
        avg_test_coverage: Math.round((sum.test_coverage / count) * 100) / 100,
        score_count: count,
        confidence_badge: count >= MIN_CONFIDENCE_THRESHOLD ? "CONFIDENT" : "LOW_CONFIDENCE",
      };
    }
  }

  return {
    developer_id,
    workspace_id,
    window_30d: aggregates[30],
    window_60d: aggregates[60],
    window_90d: aggregates[90],
    last_computed_at: now.toISOString(),
  };
}

/**
 * Compute aggregates for all developers in a workspace
 * Called periodically or after bulk PR ingestion
 */
export async function computeWorkspaceAggregates(
  supabase: any,
  workspace_id: string
): Promise<{ developers_updated: number; aggregates_recomputed: number }> {
  // Get all members who have scored PRs in this workspace
  const { data: developers, error: devError } = await supabase
    .from("pr_scores")
    .select("pull_requests!inner(author_id, workspace_id)")
    .eq("pull_requests.workspace_id", workspace_id)
    .then((result: any) => ({
      data: result.data ? [...new Set(result.data.map((r: any) => r.pull_requests.author_id))] : [],
      error: result.error,
    }));

  if (devError) {
    console.error("Error fetching developers:", devError);
    return { developers_updated: 0, aggregates_recomputed: 0 };
  }

  if (!developers || developers.length === 0) {
    return { developers_updated: 0, aggregates_recomputed: 0 };
  }

  let recomputed = 0;

  for (const developer_id of developers) {
    const agg = await computeDeveloperAggregates(supabase, workspace_id, developer_id);

    // Upsert into pr_aggregates
    const { error: upsertError } = await supabase
      .from("pr_aggregates")
      .upsert({
        workspace_id,
        developer_id,
        avg_code_quality_30d: agg.window_30d.avg_code_quality,
        avg_bug_risk_30d: agg.window_30d.avg_bug_risk,
        avg_architecture_30d: agg.window_30d.avg_architecture,
        avg_test_coverage_30d: agg.window_30d.avg_test_coverage,
        score_count_30d: agg.window_30d.score_count,
        confidence_badge_30d: agg.window_30d.confidence_badge,
        avg_code_quality_60d: agg.window_60d.avg_code_quality,
        avg_bug_risk_60d: agg.window_60d.avg_bug_risk,
        avg_architecture_60d: agg.window_60d.avg_architecture,
        avg_test_coverage_60d: agg.window_60d.avg_test_coverage,
        score_count_60d: agg.window_60d.score_count,
        confidence_badge_60d: agg.window_60d.confidence_badge,
        avg_code_quality_90d: agg.window_90d.avg_code_quality,
        avg_bug_risk_90d: agg.window_90d.avg_bug_risk,
        avg_architecture_90d: agg.window_90d.avg_architecture,
        avg_test_coverage_90d: agg.window_90d.avg_test_coverage,
        score_count_90d: agg.window_90d.score_count,
        confidence_badge_90d: agg.window_90d.confidence_badge,
        last_computed_at: agg.last_computed_at,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error(`Error upserting aggregate for ${developer_id}:`, upsertError);
    } else {
      recomputed++;
    }
  }

  return { developers_updated: developers.length, aggregates_recomputed: recomputed };
}

/**
 * Incremental update after a single PR is scored
 * Called from scoring endpoint to keep aggregates fresh
 */
export async function updateAggregatesForPR(
  supabase: any,
  workspace_id: string,
  pr_id: string
): Promise<void> {
  // Get PR details
  const { data: pr, error: prError } = await supabase
    .from("pull_requests")
    .select("author_id")
    .eq("id", pr_id)
    .single();

  if (prError || !pr) {
    console.warn("PR not found for aggregate update:", pr_id);
    return;
  }

  // Recompute for this developer
  const agg = await computeDeveloperAggregates(supabase, workspace_id, pr.author_id);

  // Upsert
  const { error: upsertError } = await supabase
    .from("pr_aggregates")
    .upsert({
      workspace_id,
      developer_id: pr.author_id,
      avg_code_quality_30d: agg.window_30d.avg_code_quality,
      avg_bug_risk_30d: agg.window_30d.avg_bug_risk,
      avg_architecture_30d: agg.window_30d.avg_architecture,
      avg_test_coverage_30d: agg.window_30d.avg_test_coverage,
      score_count_30d: agg.window_30d.score_count,
      confidence_badge_30d: agg.window_30d.confidence_badge,
      avg_code_quality_60d: agg.window_60d.avg_code_quality,
      avg_bug_risk_60d: agg.window_60d.avg_bug_risk,
      avg_architecture_60d: agg.window_60d.avg_architecture,
      avg_test_coverage_60d: agg.window_60d.avg_test_coverage,
      score_count_60d: agg.window_60d.score_count,
      confidence_badge_60d: agg.window_60d.confidence_badge,
      avg_code_quality_90d: agg.window_90d.avg_code_quality,
      avg_bug_risk_90d: agg.window_90d.avg_bug_risk,
      avg_architecture_90d: agg.window_90d.avg_architecture,
      avg_test_coverage_90d: agg.window_90d.avg_test_coverage,
      score_count_90d: agg.window_90d.score_count,
      confidence_badge_90d: agg.window_90d.confidence_badge,
      last_computed_at: agg.last_computed_at,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error("Error updating aggregates for PR:", upsertError);
  }
}

/**
 * Get confidence badge for a developer in a workspace
 * Returns "LOW_CONFIDENCE" if fewer than 3 scored PRs in window
 * Returns "CONFIDENT" if 3+ scored PRs in window
 */
export async function getConfidenceBadge(
  supabase: any,
  workspace_id: string,
  developer_id: string,
  window: 30 | 60 | 90
): Promise<"LOW_CONFIDENCE" | "CONFIDENT"> {
  const { data: agg, error } = await supabase
    .from("pr_aggregates")
    .select(`confidence_badge_${window}d`)
    .eq("workspace_id", workspace_id)
    .eq("developer_id", developer_id)
    .single();

  if (error || !agg) {
    return "LOW_CONFIDENCE"; // Default to low confidence if not found
  }

  const badgeField = `confidence_badge_${window}d`;
  return agg[badgeField] || "LOW_CONFIDENCE";
}

/**
 * Get all aggregates for a developer
 */
export async function getDeveloperAggregates(
  supabase: any,
  workspace_id: string,
  developer_id: string
): Promise<DeveloperAggregate | null> {
  const { data: agg, error } = await supabase
    .from("pr_aggregates")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("developer_id", developer_id)
    .single();

  if (error || !agg) {
    return null;
  }

  return {
    developer_id,
    workspace_id,
    window_30d: {
      days: 30,
      avg_code_quality: agg.avg_code_quality_30d,
      avg_bug_risk: agg.avg_bug_risk_30d,
      avg_architecture: agg.avg_architecture_30d,
      avg_test_coverage: agg.avg_test_coverage_30d,
      score_count: agg.score_count_30d,
      confidence_badge: agg.confidence_badge_30d,
    },
    window_60d: {
      days: 60,
      avg_code_quality: agg.avg_code_quality_60d,
      avg_bug_risk: agg.avg_bug_risk_60d,
      avg_architecture: agg.avg_architecture_60d,
      avg_test_coverage: agg.avg_test_coverage_60d,
      score_count: agg.score_count_60d,
      confidence_badge: agg.confidence_badge_60d,
    },
    window_90d: {
      days: 90,
      avg_code_quality: agg.avg_code_quality_90d,
      avg_bug_risk: agg.avg_bug_risk_90d,
      avg_architecture: agg.avg_architecture_90d,
      avg_test_coverage: agg.avg_test_coverage_90d,
      score_count: agg.score_count_90d,
      confidence_badge: agg.confidence_badge_90d,
    },
    last_computed_at: agg.last_computed_at,
  };
}
