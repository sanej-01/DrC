/**
 * Ingestion Pipeline Guards
 * Phase 3.6: Safety checks and disclosures
 *
 * Guards:
 * - TC-ING-007: Draft/synchronize ignored (not merged)
 * - TC-EDG-009: Empty diff (0 files changed) skip scoring
 * - TC-ING-006: Large PR alert (>500 files or >10k lines)
 * - File-level disclosure: track which files scored/omitted
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Configuration
const LARGE_PR_FILE_THRESHOLD = 500; // Alert if > 500 files
const LARGE_PR_LINES_THRESHOLD = 10000; // Alert if > 10k lines changed
const FILE_SCORE_LIMIT = 200; // Score only first 200 files (rest marked as omitted)

export interface GuardResult {
  pr_id: string;
  should_skip_scoring: boolean; // true = skip scoring (empty diff)
  should_alert: boolean; // true = create alert
  alert_type?: string; // 'empty_diff', 'large_pr', 'draft'
  alert_message?: string;
  details?: Record<string, any>;
}

/**
 * Check if PR should be skipped from scoring
 * TC-EDG-009: Empty diff skip
 * TC-ING-007: Draft/synchronize skip (already filtered by webhook, but check anyway)
 */
export async function checkSkipScoring(
  prId: string,
  filesChanged: number,
  isDraft: boolean
): Promise<GuardResult> {
  const result: GuardResult = {
    pr_id: prId,
    should_skip_scoring: false,
    should_alert: false,
  };

  // TC-EDG-009: Skip if no files changed
  if (filesChanged === 0) {
    result.should_skip_scoring = true;
    result.should_alert = true;
    result.alert_type = "empty_diff";
    result.alert_message = "PR has no file changes (0 files). Scoring skipped.";
    result.details = { files_changed: 0 };
    return result;
  }

  // TC-ING-007: Skip if draft (shouldn't happen, but double-check)
  if (isDraft) {
    result.should_skip_scoring = true;
    result.should_alert = true;
    result.alert_type = "draft_pr";
    result.alert_message = "PR is still a draft. Scoring skipped.";
    return result;
  }

  return result;
}

/**
 * Check if PR is large and should trigger alert
 * TC-ING-006: Large PR handling with disclosure
 */
export async function checkLargePR(
  prId: string,
  filesChanged: number,
  additionsCount: number,
  deletionsCount: number
): Promise<GuardResult> {
  const result: GuardResult = {
    pr_id: prId,
    should_skip_scoring: false,
    should_alert: false,
  };

  const totalLinesChanged = additionsCount + deletionsCount;

  // Check if large
  if (filesChanged > LARGE_PR_FILE_THRESHOLD || totalLinesChanged > LARGE_PR_LINES_THRESHOLD) {
    result.should_alert = true;
    result.alert_type = "large_pr";
    result.alert_message =
      `Large PR detected: ${filesChanged} files, ${totalLinesChanged} lines changed. ` +
      `Only first ${FILE_SCORE_LIMIT} files will be fully scored. File-level disclosure available.`;
    result.details = {
      files_changed: filesChanged,
      lines_changed: totalLinesChanged,
      files_scored_limit: FILE_SCORE_LIMIT,
      omitted_files: Math.max(0, filesChanged - FILE_SCORE_LIMIT),
    };
  }

  return result;
}

/**
 * Record scoring alert in database
 */
export async function recordAlert(
  workspaceId: string,
  prId: string,
  alertType: string,
  severity: "warning" | "error" | "info",
  message: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    await supabase.from("pr_scoring_alerts").insert({
      workspace_id: workspaceId,
      pr_id: prId,
      alert_type: alertType,
      severity: severity,
      message: message,
      details: details,
    });
  } catch (error) {
    console.error("Error recording alert:", error);
    // Don't throw — alert failure shouldn't block scoring
  }
}

/**
 * Record file-level disclosure
 * Used for large PRs to show which files were included/omitted
 */
export async function recordFileDisclosure(
  prId: string,
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    included: boolean; // true if scored, false if omitted
  }>
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const records = files.map((file) => ({
      pr_id: prId,
      file_path: file.path,
      included_in_scoring: file.included,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.additions + file.deletions,
    }));

    await supabase.from("pr_scored_files").insert(records);
  } catch (error) {
    console.error("Error recording file disclosure:", error);
    // Don't throw — disclosure failure shouldn't block scoring
  }
}

/**
 * Get file disclosure for a PR (for developer feedback)
 */
export async function getFileDisclosure(prId: string): Promise<{
  total_files: number;
  scored_files: number;
  omitted_files: number;
  files: Array<{
    path: string;
    included: boolean;
    changes: number;
  }>;
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: files, error } = await supabase
      .from("pr_scored_files")
      .select("file_path, included_in_scoring, changes")
      .eq("pr_id", prId)
      .order("changes", { ascending: false });

    if (error) throw error;

    const scored = files?.filter((f) => f.included_in_scoring).length || 0;
    const omitted = files?.filter((f) => !f.included_in_scoring).length || 0;

    return {
      total_files: files?.length || 0,
      scored_files: scored,
      omitted_files: omitted,
      files: (files || []).map((f) => ({
        path: f.file_path,
        included: f.included_in_scoring,
        changes: f.changes,
      })),
    };
  } catch (error) {
    console.error("Error fetching file disclosure:", error);
    return {
      total_files: 0,
      scored_files: 0,
      omitted_files: 0,
      files: [],
    };
  }
}

/**
 * Get alerts for a PR
 */
export async function getAlerts(prId: string): Promise<
  Array<{
    alert_type: string;
    severity: string;
    message: string;
    details?: Record<string, any>;
  }>
> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: alerts, error } = await supabase
      .from("pr_scoring_alerts")
      .select("alert_type, severity, message, details")
      .eq("pr_id", prId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      alerts?.map((a) => ({
        alert_type: a.alert_type,
        severity: a.severity,
        message: a.message,
        details: a.details,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return [];
  }
}
