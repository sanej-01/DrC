import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/team
 * Returns team members for a workspace (manager+ only)
 * Query params: workspaceId
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    // Fetch team members for this workspace
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data: team, error } = await supabase
      .from("memberships")
      .select(
        `
        user_id,
        role,
        users:user_id (
          id,
          display_name,
          email,
          github_handle
        )
      `
      )
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch team" },
        { status: 500 }
      );
    }

    return NextResponse.json({ team });
  });
}
