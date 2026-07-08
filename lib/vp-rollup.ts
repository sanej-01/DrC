/**
 * VP Rollup Library (Phase 8.2)
 * Organization and team composite analytics
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface TeamAggregate {
  id: string;
  workspace_id: string;
  team_name: string;
  avg_code_quality_30d?: number;
  avg_bug_risk_30d?: number;
  avg_architecture_30d?: number;
  avg_test_coverage_30d?: number;
  overall_score_30d?: number;
  developer_count: number;
  total_prs_30d: number;
  trend: "improving" | "stable" | "declining";
  created_at: string;
}

export interface EarlyWarning {
  id: string;
  workspace_id: string;
  team_name: string;
  warning_type: "score_drop" | "low_velocity" | "quality_risk" | "retention_risk";
  severity: "info" | "warning" | "critical";
  title: string;
  description?: string;
  metric_name?: string;
  threshold_value?: number;
  actual_value?: number;
  status: "active" | "acknowledged" | "resolved";
  created_at: string;
}

export interface WorkspaceSnapshot {
  total_developers: number;
  total_teams: number;
  total_prs_30d: number;
  avg_score_30d?: number;
  teams_improving: number;
  teams_stable: number;
  teams_declining: number;
  critical_warnings: number;
  trend: "improving" | "stable" | "declining";
}

/**
 * Fetch all team aggregates for workspace
 */
export async function getTeamAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
  sortBy: "score" | "developers" | "trend" = "score"
): Promise<TeamAggregate[]> {
  let query = supabase
    .from("team_aggregates")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (sortBy === "score") {
    query = query.order("overall_score_30d", { ascending: false, nullsFirst: false });
  } else if (sortBy === "developers") {
    query = query.order("developer_count", { ascending: false });
  } else if (sortBy === "trend") {
    // Sort by trend: improving, stable, declining
    query = query.order("trend", { ascending: true });
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as TeamAggregate[];
}

/**
 * Fetch active early warnings
 */
export async function getEarlyWarnings(
  supabase: SupabaseClient,
  workspaceId: string,
  severityFilter?: string
): Promise<EarlyWarning[]> {
  let query = supabase
    .from("early_warnings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("severity", { ascending: true });

  if (severityFilter) {
    query = query.eq("severity", severityFilter);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as EarlyWarning[];
}

/**
 * Acknowledge an early warning
 */
export async function acknowledgeWarning(
  supabase: SupabaseClient,
  warningId: string,
  managerId: string
): Promise<EarlyWarning> {
  const { data, error } = await supabase
    .from("early_warnings")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: managerId,
    })
    .eq("id", warningId)
    .select()
    .single();

  if (error) throw error;

  return data as EarlyWarning;
}

/**
 * Get workspace overview snapshot
 */
export async function getWorkspaceSnapshot(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<WorkspaceSnapshot | null> {
  const { data, error } = await supabase
    .from("workspace_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code === "PGRST116") {
    // No snapshot yet
    return null;
  }

  if (error) throw error;

  return data as WorkspaceSnapshot;
}

/**
 * Calculate team trend
 */
export function calculateTeamTrend(
  score90d: number | null,
  score30d: number | null
): "improving" | "stable" | "declining" {
  if (!score90d || !score30d) return "stable";

  const delta = score30d - score90d;
  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "stable";
}

/**
 * Calculate overall score from dimensions
 */
export function calculateOverallScore(
  quality?: number,
  bugRisk?: number,
  architecture?: number,
  tests?: number
): number {
  const q = quality || 0;
  const r = 100 - (bugRisk || 0);
  const a = architecture || 0;
  const t = tests || 0;
  return Math.round((q + r + a + t) / 4);
}

/**
 * Format trend for display
 */
export function formatTrend(trend: string): { emoji: string; label: string; color: string } {
  switch (trend) {
    case "improving":
      return { emoji: "📈", label: "Improving", color: "green" };
    case "declining":
      return { emoji: "📉", label: "Declining", color: "red" };
    case "stable":
      return { emoji: "➡️", label: "Stable", color: "gray" };
    default:
      return { emoji: "❓", label: "Unknown", color: "gray" };
  }
}

/**
 * Format severity for display
 */
export function formatSeverity(
  severity: string
): { emoji: string; label: string; color: string } {
  switch (severity) {
    case "critical":
      return { emoji: "🔴", label: "Critical", color: "red" };
    case "warning":
      return { emoji: "🟠", label: "Warning", color: "amber" };
    case "info":
      return { emoji: "🔵", label: "Info", color: "blue" };
    default:
      return { emoji: "⚪", label: "Unknown", color: "gray" };
  }
}
