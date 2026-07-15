import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revokeGitHubToken } from "@/lib/github-oauth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/auth/github/disconnect
 * Disconnect/revoke GitHub OAuth token
 * Phase 2.3: Removes token from database and revokes with GitHub
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get current user from auth header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get GitHub token
    const { data: tokenRecord, error: getError } = await supabase
      .from("github_oauth_tokens")
      .select("access_token, github_handle")
      .eq("user_id", user.id)
      .single();

    if (getError || !tokenRecord) {
      return NextResponse.json(
        { error: "No GitHub token found" },
        { status: 404 }
      );
    }

    // Revoke token with GitHub
    try {
      await revokeGitHubToken(tokenRecord.access_token);
    } catch (revokeError) {
      console.error("Error revoking GitHub token:", revokeError);
      // Continue anyway — delete local token even if revoke fails
    }

    // Delete token from database
    const { error: deleteError } = await supabase
      .from("github_oauth_tokens")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      throw deleteError;
    }

    // Log disconnection to audit
    await supabase.from("audit_log").insert({
      action: "github_oauth_disconnected",
      subject_type: "user",
      subject_id: user.id,
      details: {
        github_handle: tokenRecord.github_handle,
      },
    });

    return NextResponse.json({ status: "disconnected" });
  } catch (error) {
    console.error("GitHub disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect GitHub" },
      { status: 500 }
    );
  }
}
