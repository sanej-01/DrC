import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/vp/portfolio
 * Fetch VP dashboard data: team aggregates, early warnings, workspace snapshot
 * Query params: workspaceId
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Fetch team aggregates
    const { data: teams, error: teamsError } = await supabase
      .from("team_aggregates")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("overall_score_30d", { ascending: false, nullsFirst: false });

    if (teamsError) {
      return NextResponse.json(
        { error: "Failed to fetch team data" },
        { status: 500 }
      );
    }

    // Fetch early warnings
    const { data: warnings, error: warningsError } = await supabase
      .from("early_warnings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("severity", { ascending: true })
      .limit(5);

    if (warningsError) {
      return NextResponse.json(
        { error: "Failed to fetch warnings" },
        { status: 500 }
      );
    }

    // Fetch workspace snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from("workspace_snapshots")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (snapshotError && snapshotError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch snapshot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      teams: teams || [],
      warnings: warnings || [],
      snapshot: snapshot || null,
    });
  });
}
