import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Manager notes, rewritten against the live schema. The original version
 * embedded `users:manager_id(display_name,email)`, but there is no
 * `users` table live — member identity lives in `workspace_members`
 * (display_name) + `auth.users` (email). So the manager's name is
 * resolved with a second lookup instead of a PostgREST join.
 *
 * Requires the `manager_notes` table — run
 * supabase/seeds/create-manager-notes-table.sql once in the Supabase
 * SQL Editor. Until then GET returns { note: null } gracefully rather
 * than 500ing the whole developer page.
 */

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

async function resolveManager(
  supabase: SupabaseClient,
  workspaceId: string,
  managerId: string
): Promise<{ display_name: string; email: string } | undefined> {
  const { data: member } = await supabase
    .from("workspace_members")
    .select("display_name")
    .eq("workspace_id", workspaceId)
    .eq("user_id", managerId)
    .maybeSingle();

  const { data: authUser } = await supabase.auth.admin.getUserById(managerId);
  const email = authUser?.user?.email || "";

  return {
    display_name: member?.display_name || email || "Manager",
    email,
  };
}

/** Missing table (42P01) shouldn't crash the page — treat as "no note". */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const supabase = admin();
    const { developerId } = await params;

    const { data, error } = await supabase
      .from("manager_notes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId)
      .maybeSingle();

    if (error && !isMissingTable(error) && error.code !== "PGRST116") {
      return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ note: null });
    }

    const manager = await resolveManager(supabase, workspaceId, data.manager_id);
    return NextResponse.json({ note: { ...data, manager } });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const supabase = admin();
    const { developerId } = await params;

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
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
      .select("*")
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          {
            error:
              "Notes storage isn't set up yet — run create-manager-notes-table.sql in Supabase.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }

    const manager = await resolveManager(supabase, workspaceId, data.manager_id);
    return NextResponse.json({ note: { ...data, manager } });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ developerId: string }> }
) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const supabase = admin();
    const { developerId } = await params;

    const { error } = await supabase
      .from("manager_notes")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("developer_id", developerId);

    if (error && !isMissingTable(error)) {
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
