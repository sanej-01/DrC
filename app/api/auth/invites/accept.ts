import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { backfillDeveloperPRs } from "@/lib/backfill";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/auth/invites/accept
 * Accept developer invite, join workspace, trigger backfill
 * Phase 2.5: Developers use invite token to join
 *
 * Body: {
 *   token: string (invite token),
 * }
 *
 * Requires: Authenticated user
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

    // Parse request
    const body = await request.json();
    const { token: inviteToken } = body;

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Invite token required" },
        { status: 400 }
      );
    }

    // Look up invite token
    const { data: invite, error: inviteError } = await supabase
      .from("invite_tokens")
      .select("*")
      .eq("token", inviteToken)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    // Check if invite is still valid
    if (invite.used_count >= invite.max_uses) {
      return NextResponse.json(
        { error: "Invite has reached max uses" },
        { status: 409 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 }
      );
    }

    // Check email pattern if specified
    if (invite.email_pattern && user.email) {
      if (!user.email.endsWith(invite.email_pattern)) {
        return NextResponse.json(
          { error: "Email does not match invite pattern" },
          { status: 403 }
        );
      }
    }

    // Get or create user record
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (userError && userError.code !== "PGRST116") {
      throw userError;
    }

    let userId = userRecord?.id;

    if (!userId) {
      // Create user record
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          auth_id: user.id,
          email: user.email || "",
          display_name: user.user_metadata?.full_name,
          avatar_url: user.user_metadata?.avatar_url,
        })
        .select("id")
        .single();

      if (createError) throw createError;
      userId = newUser.id;
    }

    // Check for duplicate membership (idempotent)
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("id")
      .eq("workspace_id", invite.workspace_id)
      .eq("user_id", userId)
      .single();

    if (existingMembership) {
      // Already a member — update used_count and return existing membership
      await supabase
        .from("invite_tokens")
        .update({ used_count: invite.used_count + 1 })
        .eq("id", invite.id);

      return NextResponse.json(
        {
          status: "already_member",
          workspace_id: invite.workspace_id,
          membership_id: existingMembership.id,
        },
        { status: 200 }
      );
    }

    // Add user as developer member
    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .insert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        role: "developer",
      })
      .select()
      .single();

    if (memberError) {
      console.error("Error creating membership:", memberError);
      return NextResponse.json(
        { error: "Failed to join workspace" },
        { status: 500 }
      );
    }

    // Increment used_count on invite token
    await supabase
      .from("invite_tokens")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    // Log invite acceptance
    await supabase.from("audit_log").insert({
      workspace_id: invite.workspace_id,
      action: "invite_accepted",
      subject_type: "user",
      subject_id: userId,
      details: {
        invite_id: invite.id,
        email: user.email,
      },
    });

    // Trigger developer backfill (TC-ING-004: backfill enqueued for developer)
    // This will fetch all PRs authored by this developer across workspace repos
    const backfillResult = await backfillDeveloperPRs(
      invite.workspace_id,
      userId,
      90 // Last 90 days
    );

    // Log backfill trigger
    await supabase.from("audit_log").insert({
      workspace_id: invite.workspace_id,
      action: "dev_backfill_triggered",
      subject_type: "user",
      subject_id: userId,
      details: {
        enqueued_count: backfillResult.enqueued_count,
        error: backfillResult.error,
      },
    });

    return NextResponse.json(
      {
        status: "joined",
        workspace_id: invite.workspace_id,
        membership_id: membership.id,
        backfill: {
          enqueued_count: backfillResult.enqueued_count,
          error: backfillResult.error,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
