/**
 * Retry Logic & Failure Handling
 * Phase 4.3: Resilience for scoring pipeline
 *
 * Strategy:
 * - Max 3 attempts per PR
 * - Exponential backoff: 1s, 2s, 4s
 * - Log detailed error reasons
 * - Alert manager on permanent failure
 * - Mark as scoring_failed for manual review
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export interface RetryConfig {
  max_attempts: number;
  backoff_ms: number[]; // Milliseconds to wait between attempts
  retry_on: string[]; // Error types that trigger retry
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 3,
  backoff_ms: [1000, 2000, 4000], // 1s, 2s, 4s
  retry_on: [
    "TIMEOUT",
    "RATE_LIMIT",
    "API_ERROR",
    "NETWORK_ERROR",
    "TEMPORARY_FAILURE",
  ],
};

export interface ScoringFailure {
  pr_id: string;
  pr_number: number;
  workspace_id: string;
  error_type: string;
  error_message: string;
  attempt: number;
  max_attempts: number;
  should_retry: boolean;
}

/**
 * Classify error type for retry decision
 */
export function classifyError(error: unknown): string {
  if (!error) return "UNKNOWN";

  const errorStr = String(error);

  if (errorStr.includes("timeout") || errorStr.includes("408")) {
    return "TIMEOUT";
  }
  if (errorStr.includes("rate") || errorStr.includes("429")) {
    return "RATE_LIMIT";
  }
  if (errorStr.includes("schema") || errorStr.includes("validation")) {
    return "SCHEMA_INVALID";
  }
  if (
    errorStr.includes("not found") ||
    errorStr.includes("404")
  ) {
    return "NOT_FOUND";
  }
  if (errorStr.includes("network") || errorStr.includes("connection")) {
    return "NETWORK_ERROR";
  }

  return "API_ERROR";
}

/**
 * Decide if error should trigger retry
 */
export function shouldRetryOnError(
  errorType: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // Never retry on permanent failures
  if (
    errorType === "SCHEMA_INVALID" ||
    errorType === "NOT_FOUND" ||
    errorType === "AUTHENTICATION"
  ) {
    return false;
  }

  // Retry on transient failures
  return config.retry_on.includes(errorType);
}

/**
 * Calculate backoff time for attempt
 */
export function getBackoffTime(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  if (attempt <= 0 || attempt > config.backoff_ms.length) {
    return 0;
  }
  return config.backoff_ms[attempt - 1];
}

/**
 * Handle scoring failure and decide retry/alert
 */
export async function handleScoringFailure(
  failure: ScoringFailure
): Promise<{
  will_retry: boolean;
  alert_manager: boolean;
  next_retry_ms?: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Decide if should retry
  const shouldRetry =
    shouldRetryOnError(failure.error_type) &&
    failure.attempt < failure.max_attempts;

  // Calculate next retry time
  const nextRetryMs = shouldRetry
    ? getBackoffTime(failure.attempt)
    : undefined;

  // Update queue status
  if (shouldRetry) {
    // Retry: mark as pending for next attempt
    await supabase.from("scoring_queue").update({
      status: "pending",
      attempted_count: failure.attempt,
      error_message: failure.error_message,
    });

    // Log retry attempt
    await supabase.from("audit_log").insert({
      workspace_id: failure.workspace_id,
      action: "scoring_retry",
      subject_type: "pr",
      subject_id: failure.pr_id,
      details: {
        pr_number: failure.pr_number,
        attempt: failure.attempt,
        error_type: failure.error_type,
        error_message: failure.error_message,
        next_retry_ms: nextRetryMs,
      },
    });
  } else {
    // Permanent failure: mark as failed
    await supabase.from("scoring_queue").update({
      status: "scoring_failed",
      attempted_count: failure.attempt,
      error_message: failure.error_message,
    });

    // Log permanent failure
    await supabase.from("audit_log").insert({
      workspace_id: failure.workspace_id,
      action: "scoring_failed_exhausted",
      subject_type: "pr",
      subject_id: failure.pr_id,
      details: {
        pr_number: failure.pr_number,
        attempts: failure.attempt,
        error_type: failure.error_type,
        error_message: failure.error_message,
        reason:
          failure.error_type === "SCHEMA_INVALID"
            ? "LLM response schema invalid"
            : `Failed after ${failure.attempt} attempts: ${failure.error_type}`,
      },
    });

    // Alert manager
    return {
      will_retry: false,
      alert_manager: true,
    };
  }

  return {
    will_retry: shouldRetry,
    alert_manager: false,
    next_retry_ms: nextRetryMs,
  };
}

/**
 * Create manager alert for failed PR
 */
export async function createManagerAlert(
  workspaceId: string,
  prId: string,
  prNumber: number,
  error_type: string,
  error_message: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Get manager membership for workspace
  const { data: managers } = await supabase
    .from("memberships")
    .select("user_id, users(email)")
    .eq("workspace_id", workspaceId)
    .eq("role", "manager");

  if (!managers || managers.length === 0) {
    console.warn(`No managers found for workspace ${workspaceId}`);
    return;
  }

  // Create alert message
  const alertTitle = `PR #${prNumber} scoring failed`;
  const alertMessage =
    `Scoring for PR #${prNumber} failed after 3 attempts.\n` +
    `Error: ${error_type}\n` +
    `Details: ${error_message}\n` +
    `This PR needs manual review or the issue needs to be investigated.`;

  // Log alert
  await supabase.from("audit_log").insert({
    workspace_id: workspaceId,
    action: "manager_alert_created",
    subject_type: "pr",
    subject_id: prId,
    details: {
      pr_number: prNumber,
      alert_title: alertTitle,
      alert_message: alertMessage,
      recipients: managers.map((m) => (m.users as any)?.email),
    },
  });

  // TODO: Send actual alert (Slack, email, etc.)
  console.error(`MANAGER ALERT: ${alertTitle}\n${alertMessage}`);
}

/**
 * Get scoring queue stats for monitoring
 */
export async function getScoringQueueStats(
  workspaceId: string
): Promise<{
  pending: number;
  scoring: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: stats, error } = await supabase
    .from("scoring_queue")
    .select("status")
    .eq("workspace_id", workspaceId);

  if (error || !stats) {
    console.error("Error fetching scoring stats:", error);
    return {
      pending: 0,
      scoring: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };
  }

  const counts = {
    pending: 0,
    scoring: 0,
    completed: 0,
    failed: 0,
  };

  for (const item of stats) {
    counts[item.status as keyof typeof counts]++;
  }

  return {
    ...counts,
    total: stats.length,
  };
}
