import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/manager/clear-pr-scores
 * Manual test-only utility: deletes all pr_scores rows for the
 * workspace's pull requests, so "Score PRs Now" treats them as
 * unscored again. Lets you re-test the scoring pipeline (including
 * the LLM analysis) on PRs that already have a score, without having
 * to re-scan or manually touch the database.
 *
 * Body: { workspaceId }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !member || !["manager", "admin"].includes(member.role)) {
      return NextResponse.json(
        { error: "Only managers and admins can clear scores" },
        { status: 403 }
      );
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("pr_scores")
      .delete()
      .eq("workspace_id", workspaceId)
      .select("id");

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to clear PR scores", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
      scores_cleared: deleted?.length || 0,
    });
  } catch (error) {
    console.error("Clear PR scores error:", error);
    return NextResponse.json(
      {
        error: "Failed to clear PR scores",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
