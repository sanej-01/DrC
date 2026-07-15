import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/manager/workspace/invites/create
 * Create developer invite link (manager only)
 * Phase 2.5: Generates one-time invite token
 *
 * Body: {
 *   workspace_id: UUID,
 *   email_pattern?: string (optional, e.g., "@company.com"),
 *   max_uses?: number (default: 1),
 *   expires_in_days?: number (default: 30)
 * }
 */
export async function POST(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    try {
      const body = await req.json();
      const {
        workspace_id,
        email_pattern,
        max_uses = 1,
        expires_in_days = 30,
      } = body;

      if (!workspace_id) {
        return NextResponse.json(
          { error: "workspace_id required" },
          { status: 400 }
        );
      }

      // Verify manager has access to workspace
      if (workspace_id !== workspaceId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Generate secure random token
      const token = crypto.randomBytes(32).toString("base64url");

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);

      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      // Store invite token
      const { data: invite, error: createError } = await supabase
        .from("invite_tokens")
        .insert({
          workspace_id: workspace_id,
          created_by: userId,
          token: token,
          email_pattern: email_pattern || null,
          max_uses: max_uses,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating invite:", createError);
        return NextResponse.json(
          { error: "Failed to create invite" },
          { status: 500 }
        );
      }

      // Log invite creation
      await supabase.from("audit_log").insert({
        workspace_id: workspace_id,
        action: "invite_created",
        subject_type: "invite",
        subject_id: invite.id,
        details: {
          token: token, // Log token for audit purposes
          email_pattern: email_pattern,
          max_uses: max_uses,
          expires_at: expiresAt.toISOString(),
        },
      });

      // Return invite link
      const inviteUrl = `${request.nextUrl.origin}/auth/invite?token=${token}`;

      return NextResponse.json(
        {
          invite: {
            id: invite.id,
            token: token,
            invite_url: inviteUrl,
            email_pattern: email_pattern,
            max_uses: max_uses,
            expires_at: expiresAt.toISOString(),
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Create invite error:", error);
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }
  });
}
