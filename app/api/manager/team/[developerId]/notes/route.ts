import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/team/[developerId]/notes
 * Fetch manager note for a developer
 * Query params: workspaceId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { developerId } = await params;

    const { data, error } = await supabase
      .from("manager_notes")
      .select(
        `
        *,
        users:manager_id (
          display_name,
          email
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId)
      .single();

    if (error && error.code === "PGRST116") {
      // No note exists yet - return null
      return NextResponse.json({ note: null });
    }

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ note: data });
  });
}

/**
 * POST /api/manager/team/[developerId]/notes
 * Create or update manager note (upsert)
 * Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { developerId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "Note cannot exceed 5000 characters" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("manager_notes")
      .upsert(
        {
          workspace_id: workspaceId,
          developer_id: developerId,
          manager_id: userId,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,developer_id" }
      )
      .select(
        `
        *,
        users:manager_id (
          display_name,
          email
        )
      `
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ note: data });
  });
}

/**
 * DELETE /api/manager/team/[developerId]/notes
 * Delete manager note
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { developerId } = await params;

    const { error } = await supabase
      .from("manager_notes")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  });
}
