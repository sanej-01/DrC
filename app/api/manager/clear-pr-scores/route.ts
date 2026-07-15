import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/manager/clear-pr-scores
 * Manual test-only utility: deletes all pr_scores AND pull_requests
 * rows for the workspace, so both "Scan GitHub Now" and "Score PRs
 * Now" start from a clean slate - the scanner will rediscover every
 * PR (and re-evaluate the no-PR-history fallback) instead of treating
 * previously-seen PRs as duplicates to skip.
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

    // Delete scores first (don't rely on ON DELETE CASCADE being
    // configured), then the PRs themselves.
    const { data: deletedScores, error: scoresError } = await supabase
      .from("pr_scores")
      .delete()
      .eq("workspace_id", workspaceId)
      .select("id");

    if (scoresError) {
      return NextResponse.json(
        { error: "Failed to clear PR scores", details: scoresError.message },
        { status: 500 }
      );
    }

    const { data: deletedPrs, error: prsError } = await supabase
      .from("pull_requests")
      .delete()
      .eq("workspace_id", workspaceId)
      .select("id");

    if (prsError) {
      return NextResponse.json(
        { error: "Failed to clear PR history", details: prsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
      scores_cleared: deletedScores?.length || 0,
      prs_cleared: deletedPrs?.length || 0,
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
