/**
 * Spend Guardrail — Phase 4.5
 * Daily cost cap enforcement per workspace
 * Prevent runaway scoring costs
 */

export interface DailyCostStatus {
  workspace_id: string;
  tracking_date: string;
  total_cost_cents: number;
  daily_cap_cents: number;
  pct_of_cap: number;
  is_capped: boolean;
  prs_scored: number;
}

export interface CostCheckResult {
  can_score: boolean;
  reason: string;
  cost_status: DailyCostStatus;
}

// Default global cost per PR (in cents)
// Haiku triage: ~$0.00001 (~0.001 cents)
// Sonnet scoring: ~$0.0003 (~0.03 cents)
// Total: ~0.031 cents = ~0.00031 dollars
export const COST_PER_PR_CENTS = 0.031; // Very cheap, ~$0.0003 per PR

/**
 * Get current daily cost for workspace
 */
export async function getWorkspaceDailyCost(
  supabase: any,
  workspace_id: string,
  date?: string
): Promise<DailyCostStatus> {
  const tracking_date = date || new Date().toISOString().split("T")[0];

  // Get daily cost tracking
  const { data: tracking, error: trackError } = await supabase
    .from("daily_cost_tracking")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("tracking_date", tracking_date)
    .single();

  if (trackError && trackError.code !== "PGRST116") {
    // PGRST116 = no rows, which is fine
    console.error("Error fetching daily cost:", trackError);
  }

  // Get workspace cost config (daily cap)
  const { data: config, error: configError } = await supabase
    .from("workspace_cost_config")
    .select("daily_cap_cents")
    .eq("workspace_id", workspace_id)
    .single();

  if (configError && configError.code !== "PGRST116") {
    console.error("Error fetching cost config:", configError);
  }

  const daily_cap_cents = config?.daily_cap_cents || 50000; // Default $500/day
  const total_cost_cents = tracking?.total_cost_cents || 0;
  const pct_of_cap = (total_cost_cents / daily_cap_cents) * 100;

  return {
    workspace_id,
    tracking_date,
    total_cost_cents,
    daily_cap_cents,
    pct_of_cap: Math.round(pct_of_cap * 10) / 10,
    is_capped: tracking?.is_capped || false,
    prs_scored: tracking?.prs_scored || 0,
  };
}

/**
 * Check if scoring should be allowed
 * Returns: { can_score, reason, cost_status }
 */
export async function checkDailyCapAndScore(
  supabase: any,
  workspace_id: string,
  estimated_cost_cents: number = COST_PER_PR_CENTS
): Promise<CostCheckResult> {
  // Check global kill-switch
  const globalKillSwitch = process.env.SCORING_KILL_SWITCH === "true";
  if (globalKillSwitch) {
    const costStatus = await getWorkspaceDailyCost(supabase, workspace_id);
    return {
      can_score: false,
      reason: "Global scoring disabled (SCORING_KILL_SWITCH=true)",
      cost_status: costStatus,
    };
  }

  // Get workspace cost config
  const { data: config, error: configError } = await supabase
    .from("workspace_cost_config")
    .select("enable_scoring, daily_cap_cents, pause_on_cap")
    .eq("workspace_id", workspace_id)
    .single();

  if (configError && configError.code !== "PGRST116") {
    console.error("Error fetching cost config:", configError);
  }

  const enableScoring = config?.enable_scoring ?? true;
  if (!enableScoring) {
    const costStatus = await getWorkspaceDailyCost(supabase, workspace_id);
    return {
      can_score: false,
      reason: "Scoring disabled for this workspace",
      cost_status: costStatus,
    };
  }

  // Get current daily cost
  const costStatus = await getWorkspaceDailyCost(supabase, workspace_id);

  // Check if already capped
  if (costStatus.is_capped && config?.pause_on_cap) {
    return {
      can_score: false,
      reason: `Daily cost cap reached ($${(costStatus.daily_cap_cents / 100).toFixed(2)})`,
      cost_status: costStatus,
    };
  }

  // Check if adding this PR would exceed cap
  const projected_cost = costStatus.total_cost_cents + estimated_cost_cents;
  if (projected_cost > costStatus.daily_cap_cents && config?.pause_on_cap) {
    // Mark as capped
    await supabase
      .from("daily_cost_tracking")
      .upsert({
        workspace_id,
        tracking_date: costStatus.tracking_date,
        is_capped: true,
        capped_at: new Date().toISOString(),
      });

    return {
      can_score: false,
      reason: `Would exceed daily cost cap ($${(costStatus.daily_cap_cents / 100).toFixed(2)})`,
      cost_status: {
        ...costStatus,
        is_capped: true,
      },
    };
  }

  return {
    can_score: true,
    reason: "Within daily cost cap",
    cost_status: costStatus,
  };
}

/**
 * Log cost for a scoring action
 */
export async function logCost(
  supabase: any,
  workspace_id: string,
  pr_id: string,
  action: "triage" | "score" | "refetch" | "error_retry",
  model: string,
  tokens_input: number,
  tokens_output: number,
  estimated_cost_cents: number
): Promise<void> {
  const tracking_date = new Date().toISOString().split("T")[0];

  // Insert into cost_ledger
  const { error: ledgerError } = await supabase.from("cost_ledger").insert({
    workspace_id,
    pr_id,
    action,
    model,
    tokens_input,
    tokens_output,
    estimated_cost_cents,
    tracking_date,
  });

  if (ledgerError) {
    console.error("Error logging cost:", ledgerError);
    return;
  }

  // Update or create daily_cost_tracking
  const { data: existing, error: fetchError } = await supabase
    .from("daily_cost_tracking")
    .select("total_cost_cents, prs_scored, prs_triage_only")
    .eq("workspace_id", workspace_id)
    .eq("tracking_date", tracking_date)
    .single();

  const newTotal = (existing?.total_cost_cents || 0) + estimated_cost_cents;
  const newPrsScored =
    (existing?.prs_scored || 0) + (action === "score" ? 1 : 0);
  const newPrsTriageOnly =
    (existing?.prs_triage_only || 0) + (action === "triage" && newPrsScored === existing?.prs_scored ? 1 : 0);

  const { error: upsertError } = await supabase
    .from("daily_cost_tracking")
    .upsert({
      workspace_id,
      tracking_date,
      total_cost_cents: newTotal,
      prs_scored: newPrsScored,
      prs_triage_only: newPrsTriageOnly,
      estimated_cost_cents: newTotal, // Alias for consistency
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error("Error updating daily cost tracking:", upsertError);
  }
}

/**
 * Should scoring be enabled?
 * Returns boolean check for use in conditional logic
 */
export async function shouldEnableScoring(
  supabase: any,
  workspace_id: string
): Promise<boolean> {
  const result = await checkDailyCapAndScore(supabase, workspace_id);
  return result.can_score;
}

/**
 * Get cost breakdown for workspace
 */
export async function getCostBreakdown(
  supabase: any,
  workspace_id: string,
  date?: string
): Promise<{
  total_cost_cents: number;
  by_model: Record<string, number>;
  by_action: Record<string, number>;
  prs_counted: number;
}> {
  const tracking_date = date || new Date().toISOString().split("T")[0];

  const { data: ledger, error } = await supabase
    .from("cost_ledger")
    .select("model, action, estimated_cost_cents")
    .eq("workspace_id", workspace_id)
    .eq("tracking_date", tracking_date);

  if (error) {
    console.error("Error fetching cost breakdown:", error);
    return {
      total_cost_cents: 0,
      by_model: {},
      by_action: {},
      prs_counted: 0,
    };
  }

  const by_model: Record<string, number> = {};
  const by_action: Record<string, number> = {};
  let total_cost = 0;
  const unique_prs = new Set<string>();

  if (ledger) {
    for (const entry of ledger) {
      by_model[entry.model] = (by_model[entry.model] || 0) + (entry.estimated_cost_cents || 0);
      by_action[entry.action] = (by_action[entry.action] || 0) + (entry.estimated_cost_cents || 0);
      total_cost += entry.estimated_cost_cents || 0;
    }
  }

  return {
    total_cost_cents: Math.round(total_cost * 10000) / 10000,
    by_model,
    by_action,
    prs_counted: unique_prs.size,
  };
}

/**
 * Reset daily cap (admin action)
 */
export async function resetDailyCap(
  supabase: any,
  workspace_id: string,
  date?: string
): Promise<void> {
  const tracking_date = date || new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("daily_cost_tracking")
    .upsert({
      workspace_id,
      tracking_date,
      is_capped: false,
      reset_by_admin: true,
      reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error resetting daily cap:", error);
  }
}

/**
 * Update workspace cost configuration
 */
export async function updateCostConfig(
  supabase: any,
  workspace_id: string,
  config: {
    daily_cap_cents?: number;
    enable_scoring?: boolean;
    pause_on_cap?: boolean;
    alert_at_pct_of_cap?: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from("workspace_cost_config")
    .upsert({
      workspace_id,
      ...config,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error updating cost config:", error);
  }
}
