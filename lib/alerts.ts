/**
 * Alerts Library (Phase 6.4)
 * Manager alerts for score drops and other events
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface Alert {
  id: string;
  workspace_id: string;
  manager_id: string;
  developer_id: string;
  alert_type: "score_drop" | "new_feedback" | "dispute_filed";
  title: string;
  description?: string;
  metric_name?: string;
  metric_old_value?: number;
  metric_new_value?: number;
  threshold_delta?: number;
  pr_id?: string;
  coaching_card_id?: string;
  dispute_id?: string;
  status: "active" | "snoozed" | "dismissed";
  snoozed_until?: string;
  dismissed_at?: string;
  dismissal_reason?: string;
  created_at: string;
  updated_at: string;
  developer?: {
    display_name: string;
    github_handle?: string;
  };
}

/**
 * Fetch active and snoozed alerts for a manager
 * Expired snooze alerts are returned as active
 */
export async function getManagerAlerts(
  supabase: SupabaseClient,
  workspaceId: string,
  limit: number = 10
): Promise<Alert[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("alerts")
    .select(
      `
      *,
      users:developer_id (
        display_name,
        github_handle
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "snoozed"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Move expired snooze alerts back to active
  const alerts = (data || []).map((alert: any) => {
    if (
      alert.status === "snoozed" &&
      alert.snoozed_until &&
      new Date(alert.snoozed_until) <= new Date(now)
    ) {
      return { ...alert, status: "active" };
    }
    return alert;
  });

  return alerts as Alert[];
}

/**
 * Fetch count of active alerts
 */
export async function getActiveAlertCount(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("alerts")
    .select("id", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .lte("created_at", now);

  if (error) throw error;

  return data?.length || 0;
}

/**
 * Create score drop alert
 */
export async function createScoreDropAlert(
  supabase: SupabaseClient,
  workspaceId: string,
  managerId: string,
  developerId: string,
  metricName: string,
  oldValue: number,
  newValue: number,
  delta: number
): Promise<Alert> {
  const title = `Score drop detected: ${metricName}`;
  const description = `${metricName} decreased from ${oldValue.toFixed(1)} to ${newValue.toFixed(1)} (${delta > 0 ? "+" : ""}${delta.toFixed(1)})`;

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      workspace_id: workspaceId,
      manager_id: managerId,
      developer_id: developerId,
      alert_type: "score_drop",
      title,
      description,
      metric_name: metricName,
      metric_old_value: oldValue,
      metric_new_value: newValue,
      threshold_delta: delta,
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;

  // Log alert creation
  await supabase.from("alert_actions_log").insert({
    alert_id: data.id,
    action: "created",
    performed_by: managerId,
    reason: "Automatic score drop detection",
  });

  return data as Alert;
}

/**
 * Snooze an alert
 * Minutes: duration to snooze (default 1440 = 24 hours)
 */
export async function snoozeAlert(
  supabase: SupabaseClient,
  alertId: string,
  managerId: string,
  minutes: number = 1440
): Promise<Alert> {
  const snoozeUntil = new Date(
    new Date().getTime() + minutes * 60000
  ).toISOString();

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: "snoozed",
      snoozed_until: snoozeUntil,
      snoozed_by: managerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .select()
    .single();

  if (error) throw error;

  // Log snooze
  await supabase.from("alert_actions_log").insert({
    alert_id: alertId,
    action: "snoozed",
    performed_by: managerId,
    reason: `Snoozed for ${minutes} minutes`,
  });

  return data as Alert;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(
  supabase: SupabaseClient,
  alertId: string,
  managerId: string,
  reason?: string
): Promise<Alert> {
  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_by: managerId,
      dismissal_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .select()
    .single();

  if (error) throw error;

  // Log dismissal
  await supabase.from("alert_actions_log").insert({
    alert_id: alertId,
    action: "dismissed",
    performed_by: managerId,
    reason,
  });

  return data as Alert;
}

/**
 * Get alert count by type
 */
export async function getAlertCountByType(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("alerts")
    .select("alert_type")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (error) throw error;

  const counts: Record<string, number> = {
    score_drop: 0,
    new_feedback: 0,
    dispute_filed: 0,
  };

  (data || []).forEach((alert: any) => {
    counts[alert.alert_type]++;
  });

  return counts;
}

/**
 * Check if developer has recent score drop alert
 */
export async function hasDeveloperScoreDropAlert(
  supabase: SupabaseClient,
  workspaceId: string,
  developerId: string,
  hoursBack: number = 24
): Promise<boolean> {
  const cutoffTime = new Date(
    new Date().getTime() - hoursBack * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("alerts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("developer_id", developerId)
    .eq("alert_type", "score_drop")
    .eq("status", "active")
    .gte("created_at", cutoffTime)
    .limit(1);

  if (error) throw error;

  return (data?.length || 0) > 0;
}
