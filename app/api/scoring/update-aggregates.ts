import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeWorkspaceAggregates } from "@/lib/aggregates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/scoring/update-aggregates
 * Trigger computation of all developer aggregates for a workspace
 * Phase 4.4: Aggregates
 *
 * Body: { workspace_id: UUID, compute_type?: 'full' | 'partial' }
 *
 * Returns:
 * - developers_updated: count of developers processed
 * - aggregates_recomputed: count of aggregates updated
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Log computation start
    const { data: logEntry, error: logError } = await supabase
      .from("aggregate_computation_log")
      .insert({
        workspace_id,
        computation_type: "full",
        status: "in_progress",
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging computation start:", logError);
    }

    const startTime = Date.now();

    try {
      // Compute all aggregates for workspace
      const result = await computeWorkspaceAggregates(supabase, workspace_id);

      const duration_ms = Date.now() - startTime;

      // Log completion
      if (logEntry) {
        await supabase
          .from("aggregate_computation_log")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            duration_ms,
            developers_updated: result.developers_updated,
            aggregates_recomputed: result.aggregates_recomputed,
          })
          .eq("id", logEntry.id);
      }

      return NextResponse.json({
        status: "completed",
        workspace_id,
        ...result,
        duration_ms,
      });
    } catch (computeError) {
      const errorMessage =
        computeError instanceof Error ? computeError.message : "Unknown error";

      const duration_ms = Date.now() - startTime;

      // Log failure
      if (logEntry) {
        await supabase
          .from("aggregate_computation_log")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            duration_ms,
            error_message: errorMessage,
          })
          .eq("id", logEntry.id);
      }

      console.error("Aggregate computation failed:", computeError);
      return NextResponse.json(
        { error: "Aggregate computation failed", details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Aggregates endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
