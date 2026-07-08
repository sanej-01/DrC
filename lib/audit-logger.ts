/**
 * Audit Logger — Phase 4.6
 * Comprehensive audit trail for compliance (SOC2, GDPR, PCI DSS)
 */

export interface AuditEntry {
  workspace_id: string;
  user_id?: string;
  action: string;
  severity: "INFO" | "NOTICE" | "WARNING" | "ERROR" | "CRITICAL";
  source: string;
  subject_type?: string;
  subject_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
}

export interface AuditQuery {
  workspace_id: string;
  action?: string;
  severity?: string;
  subject_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

/**
 * Log an audit entry
 */
export async function logAudit(
  supabase: any,
  entry: AuditEntry
): Promise<string | null> {
  const { data, error } = await supabase
    .from("audit_log")
    .insert({
      workspace_id: entry.workspace_id,
      user_id: entry.user_id || null,
      action: entry.action,
      severity: entry.severity,
      source: entry.source,
      subject_type: entry.subject_type || null,
      subject_id: entry.subject_id || null,
      details: entry.details || null,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || null,
      request_id: entry.request_id || null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging audit entry:", error);
    return null;
  }

  return data?.id || null;
}

/**
 * Log PR scored event
 */
export async function logPRScored(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  pr_number: number,
  scores: { code_quality: number; bug_risk: number; architecture: number; test_coverage: number },
  audit_data: {
    triage_model: string;
    scoring_model: string;
    total_tokens: number;
    cost_cents: number;
    latency_ms: number;
  },
  source: string = "api"
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "pr_scored",
    severity: "INFO",
    source,
    subject_type: "pr",
    subject_id: pr_id,
    details: {
      pr_number,
      scores,
      triage_model: audit_data.triage_model,
      scoring_model: audit_data.scoring_model,
      total_tokens: audit_data.total_tokens,
      cost_cents: audit_data.cost_cents,
      latency_ms: audit_data.latency_ms,
    },
  });
}

/**
 * Log scoring retry
 */
export async function logScoringRetry(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  pr_number: number,
  attempt: number,
  error_type: string,
  error_message: string
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "scoring_retry",
    severity: "WARNING",
    source: "api",
    subject_type: "pr",
    subject_id: pr_id,
    details: {
      pr_number,
      attempt,
      error_type,
      error_message,
    },
  });
}

/**
 * Log scoring failure (permanent)
 */
export async function logScoringFailurePermanent(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  pr_number: number,
  attempts: number,
  error_type: string,
  error_message: string
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "scoring_failed_exhausted",
    severity: "ERROR",
    source: "api",
    subject_type: "pr",
    subject_id: pr_id,
    details: {
      pr_number,
      attempts,
      error_type,
      error_message,
    },
  });
}

/**
 * Log cost recorded
 */
export async function logCostRecorded(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  cost_cents: number,
  model: string
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "cost_logged",
    severity: "INFO",
    source: "api",
    subject_type: "pr",
    subject_id: pr_id,
    details: {
      cost_cents,
      model,
    },
  });
}

/**
 * Log daily cost cap reached
 */
export async function logCostCapReached(
  supabase: any,
  workspace_id: string,
  daily_cost_cents: number,
  cap_cents: number
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "cost_cap_reached",
    severity: "CRITICAL",
    source: "system",
    subject_type: "config",
    details: {
      daily_cost_cents,
      cap_cents,
      message: `Daily cost cap reached: $${(daily_cost_cents / 100).toFixed(2)} / $${(cap_cents / 100).toFixed(2)}`,
    },
  });
}

/**
 * Log manager alert created
 */
export async function logManagerAlertCreated(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  pr_number: number,
  alert_type: string,
  alert_message: string
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "manager_alert_created",
    severity: "NOTICE",
    source: "system",
    subject_type: "alert",
    subject_id: pr_id,
    details: {
      pr_number,
      alert_type,
      alert_message,
    },
  });
}

/**
 * Log secret detected
 */
export async function logSecretDetected(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  secret_type: string,
  severity_level: "CRITICAL" | "HIGH" | "MEDIUM",
  file_path?: string
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    action: "secret_detected",
    severity: severity_level === "CRITICAL" ? "CRITICAL" : severity_level === "HIGH" ? "ERROR" : "WARNING",
    source: "system",
    subject_type: "pr",
    subject_id: pr_id,
    details: {
      secret_type,
      severity: severity_level,
      file_path,
    },
  });
}

/**
 * Log dispute created
 */
export async function logDisputeCreated(
  supabase: any,
  workspace_id: string,
  user_id: string,
  pr_id: string,
  dispute_reason: string
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    user_id,
    action: "dispute_created",
    severity: "NOTICE",
    source: "api",
    subject_type: "dispute",
    subject_id: pr_id,
    details: {
      reason: dispute_reason,
    },
  });
}

/**
 * Log admin action
 */
export async function logAdminAction(
  supabase: any,
  workspace_id: string,
  user_id: string,
  action_type: string,
  details: Record<string, any>
): Promise<void> {
  await logAudit(supabase, {
    workspace_id,
    user_id,
    action: "admin_action",
    severity: "NOTICE",
    source: "admin_panel",
    subject_type: "config",
    details: {
      action_type,
      ...details,
    },
  });
}

/**
 * Query audit log with filters
 */
export async function queryAuditLog(
  supabase: any,
  query: AuditQuery
): Promise<any[]> {
  let q = supabase
    .from("audit_log")
    .select("*")
    .eq("workspace_id", query.workspace_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (query.action) {
    q = q.eq("action", query.action);
  }

  if (query.severity) {
    q = q.eq("severity", query.severity);
  }

  if (query.subject_type) {
    q = q.eq("subject_type", query.subject_type);
  }

  if (query.start_date) {
    q = q.gte("created_at", query.start_date);
  }

  if (query.end_date) {
    q = q.lte("created_at", query.end_date);
  }

  const limit = query.limit || 100;
  q = q.limit(limit);

  const { data, error } = await q;

  if (error) {
    console.error("Error querying audit log:", error);
    return [];
  }

  return data || [];
}

/**
 * Get audit summary for date range
 */
export async function getAuditSummary(
  supabase: any,
  workspace_id: string,
  start_date: string,
  end_date: string
): Promise<{
  total_actions: number;
  by_action: Record<string, number>;
  by_severity: Record<string, number>;
  critical_events: any[];
}> {
  const logs = await queryAuditLog(supabase, {
    workspace_id,
    start_date,
    end_date,
    limit: 10000,
  });

  const by_action: Record<string, number> = {};
  const by_severity: Record<string, number> = {};
  const critical_events = logs.filter((log) => log.severity === "CRITICAL");

  for (const log of logs) {
    by_action[log.action] = (by_action[log.action] || 0) + 1;
    by_severity[log.severity] = (by_severity[log.severity] || 0) + 1;
  }

  return {
    total_actions: logs.length,
    by_action,
    by_severity,
    critical_events,
  };
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(
  supabase: any,
  workspace_id: string,
  start_date: string,
  end_date: string
): Promise<{
  period: string;
  workspace_id: string;
  total_actions: number;
  critical_events_count: number;
  scoring_actions_count: number;
  disputes_count: number;
  admin_actions_count: number;
  cost_cap_events: number;
  secret_detections: number;
  summary: Record<string, any>;
}> {
  const logs = await queryAuditLog(supabase, {
    workspace_id,
    start_date,
    end_date,
    limit: 100000,
  });

  const critical_events = logs.filter((log) => log.severity === "CRITICAL");
  const scoring_actions = logs.filter((log) => log.action.includes("scoring") || log.action === "pr_scored");
  const disputes = logs.filter((log) => log.action === "dispute_created");
  const admin_actions = logs.filter((log) => log.action === "admin_action");
  const cost_caps = logs.filter((log) => log.action === "cost_cap_reached");
  const secrets = logs.filter((log) => log.action === "secret_detected");

  return {
    period: `${start_date} to ${end_date}`,
    workspace_id,
    total_actions: logs.length,
    critical_events_count: critical_events.length,
    scoring_actions_count: scoring_actions.length,
    disputes_count: disputes.length,
    admin_actions_count: admin_actions.length,
    cost_cap_events: cost_caps.length,
    secret_detections: secrets.length,
    summary: {
      by_action: getActionCounts(logs),
      by_severity: getSeverityCounts(logs),
      by_source: getSourceCounts(logs),
    },
  };
}

function getActionCounts(logs: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    counts[log.action] = (counts[log.action] || 0) + 1;
  }
  return counts;
}

function getSeverityCounts(logs: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    counts[log.severity] = (counts[log.severity] || 0) + 1;
  }
  return counts;
}

function getSourceCounts(logs: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    counts[log.source] = (counts[log.source] || 0) + 1;
  }
  return counts;
}
