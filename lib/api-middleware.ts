import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { UserRole, hasRole, isManager, isAdmin } from "./auth-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * API middleware to verify authentication and authorization
 * Usage: wrap your API route handler with this
 */
export async function withAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    { userId, workspaceId, role }: APIContext
  ) => Promise<NextResponse>
) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);

    // Verify token with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.admin.getUserById(token);

    if (error || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get workspace ID from query params or body
    const workspaceId =
      request.nextUrl.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId required" },
        { status: 400 }
      );
    }

    // Get user's role in workspace
    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (memberError || !membership) {
      // Log audit entry for unauthorized access attempt (NFR-2)
      await supabase.from("audit_log").insert({
        workspace_id: workspaceId,
        action: "unauthorized_access_attempt",
        subject_type: "user",
        subject_id: user.id,
        actor_id: user.id,
        details: { endpoint: request.nextUrl.pathname },
      });

      return NextResponse.json(
        { error: "Access denied: not a member of workspace" },
        { status: 403 }
      );
    }

    const role = membership.role as UserRole;

    // Call handler with context
    return handler(request, { userId: user.id, workspaceId, role });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * API middleware to verify manager+ role
 */
export async function withManagerAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    { userId, workspaceId }: APIContext
  ) => Promise<NextResponse>
) {
  return withAuth(request, async (req, context) => {
    if (context.role !== "manager" && context.role !== "admin") {
      return NextResponse.json(
        { error: "Manager or Admin role required" },
        { status: 403 }
      );
    }
    return handler(req, context);
  });
}

/**
 * API middleware to verify admin role
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    { userId, workspaceId }: APIContext
  ) => Promise<NextResponse>
) {
  return withAuth(request, async (req, context) => {
    if (context.role !== "admin") {
      return NextResponse.json(
        { error: "Admin role required" },
        { status: 403 }
      );
    }
    return handler(req, context);
  });
}

export interface APIContext {
  userId: string;
  workspaceId: string;
  role: UserRole;
}
