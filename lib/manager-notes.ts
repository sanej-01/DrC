/**
 * Manager Notes Library (Phase 6.3)
 * Private manager-only notes on developers
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface ManagerNote {
  id: string;
  workspace_id: string;
  developer_id: string;
  manager_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  manager?: {
    display_name: string;
    email: string;
  };
}

/**
 * Fetch manager note for a developer
 * Returns null if no note exists
 */
export async function getManagerNote(
  supabase: SupabaseClient,
  workspaceId: string,
  developerId: string
): Promise<ManagerNote | null> {
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
    // No rows found - this is OK
    return null;
  }

  if (error) throw error;

  return data as ManagerNote;
}

/**
 * Create or update manager note (upsert)
 * If note exists, updates content and timestamp
 */
export async function saveManagerNote(
  supabase: SupabaseClient,
  workspaceId: string,
  developerId: string,
  managerId: string,
  content: string
): Promise<ManagerNote> {
  const { data, error } = await supabase
    .from("manager_notes")
    .upsert(
      {
        workspace_id: workspaceId,
        developer_id: developerId,
        manager_id: managerId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id, developer_id" }
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

  if (error) throw error;

  return data as ManagerNote;
}

/**
 * Delete manager note
 */
export async function deleteManagerNote(
  supabase: SupabaseClient,
  noteId: string
): Promise<void> {
  const { error } = await supabase
    .from("manager_notes")
    .delete()
    .eq("id", noteId);

  if (error) throw error;
}

/**
 * Check if manager has permission to view/edit notes for this developer
 * (Used on client to show/hide note editor)
 */
export function canEditNote(userRole: string | null): boolean {
  return userRole === "manager" || userRole === "admin";
}

/**
 * Format timestamp for display
 */
export function formatNoteTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
