import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api-middleware";

/**
 * POST /api/admin/workspace
 * Creates a new workspace (admin only)
 * Body: { name, slug }
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req, { userId, workspaceId }) => {
    try {
      const body = await req.json();
      const { name, slug } = body;

      if (!name || !slug) {
        return NextResponse.json(
          { error: "name and slug required" },
          { status: 400 }
        );
      }

      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );

      // Create workspace
      const { data: workspace, error } = await supabase
        .from("workspaces")
        .insert({ name, slug })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to create workspace" },
          { status: 500 }
        );
      }

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from("memberships")
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: "admin",
        });

      if (memberError) {
        return NextResponse.json(
          { error: "Failed to add admin member" },
          { status: 500 }
        );
      }

      return NextResponse.json({ workspace }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }
  });
}
