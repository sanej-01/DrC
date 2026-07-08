import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getWorkspaceDailyCost,
  getCostBreakdown,
  resetDailyCap,
  updateCostConfig,
} from "@/lib/spend-guardrail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * GET /api/scoring/cost-status?workspaceId=UUID
 * Get current daily cost status for workspace
 * Phase 4.5: Spend guardrail
 *
 * Returns:
 * - total_cost_cents
 * - daily_cap_cents
 * - pct_of_cap
 * - is_capped
 * - prs_scored
 * - cost_breakdown (by model, by action)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get("workspaceId");

    if (!workspace_id) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get cost status
    const costStatus = await getWorkspaceDailyCost(supabase, workspace_id);

    // Get breakdown
    const breakdown = await getCostBreakdown(supabase, workspace_id);

    return NextResponse.json({
      status: "ok",
      cost_status: costStatus,
      cost_breakdown: breakdown,
    });
  } catch (error) {
    console.error("Cost status endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/scoring/cost-status
 * Admin actions: reset cap, update config
 * Phase 4.5: Spend guardrail
 *
 * Body: {
 *   action: "reset_cap" | "update_config",
 *   workspaceId: UUID,
 *   date?: YYYY-MM-DD,
 *   config?: { daily_cap_cents, enable_scoring, pause_on_cap, alert_at_pct_of_cap }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, workspaceId, date, config } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (action === "reset_cap") {
      // Reset daily cap (admin only)
      await resetDailyCap(supabase, workspaceId, date);

      const costStatus = await getWorkspaceDailyCost(supabase, workspaceId, date);
      return NextResponse.json({
        status: "cap_reset",
        cost_status: costStatus,
      });
    } else if (action === "update_config") {
      // Update cost configuration (admin only)
      if (!config) {
        return NextResponse.json({ error: "config required for update_config action" }, { status: 400 });
      }

      await updateCostConfig(supabase, workspaceId, config);

      return NextResponse.json({
        status: "config_updated",
        config,
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Cost status POST endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
