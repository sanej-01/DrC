import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/alerts/count
 * Get count of active alerts
 * Query params: workspaceId
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data, error } = await supabase
      .from("alerts")
      .select("id", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch alert count" },
        { status: 500 }
      );
    }

    return NextResponse.json({ count: data?.length || 0 });
  });
}
