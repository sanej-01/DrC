import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = "developer" | "manager" | "admin";

/**
 * Get user's role in a workspace
 * Returns role from memberships table
 */
export async function getUserRoleInWorkspace(
  userId: string,
  workspaceId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }

  return data?.role as UserRole;
}

/**
 * Get user's workspace IDs
 * Returns all workspaces user is a member of
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }

  return data?.map((m) => m.workspace_id) || [];
}

/**
 * Check if user has required role in workspace
 */
export async function hasRole(
  userId: string,
  workspaceId: string,
  requiredRole: UserRole | UserRole[]
): Promise<boolean> {
  const role = await getUserRoleInWorkspace(userId, workspaceId);
  if (!role) return false;

  const requiredRoles = Array.isArray(requiredRole)
    ? requiredRole
    : [requiredRole];

  // Hierarchy: admin > manager > developer
  const roleHierarchy: Record<UserRole, number> = {
    developer: 1,
    manager: 2,
    admin: 3,
  };

  const userLevel = roleHierarchy[role];
  const minRequiredLevel = Math.min(
    ...requiredRoles.map((r) => roleHierarchy[r])
  );

  return userLevel >= minRequiredLevel;
}

/**
 * Verify user has admin role (highest privilege)
 */
export async function isAdmin(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  return hasRole(userId, workspaceId, "admin");
}

/**
 * Verify user has manager or admin role
 */
export async function isManager(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  return hasRole(userId, workspaceId, ["manager", "admin"]);
}

/**
 * Verify user has any role in workspace
 */
export async function isMember(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  return hasRole(userId, workspaceId, [
    "developer",
    "manager",
    "admin",
  ]);
}
