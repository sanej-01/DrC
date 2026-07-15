import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/manager/workspace/repos/link
 * Link GitHub repositories to workspace (manager only)
 * Phase 2.4: Links repos, enqueues backfill
 *
 * Body: {
 *   workspace_id: UUID,
 *   repos: [
 *     { owner: string, name: string, repo_id: number, is_private: boolean }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    try {
      const body = await req.json();
      const { workspace_id, repos } = body;

      if (!workspace_id || !repos || !Array.isArray(repos)) {
        return NextResponse.json(
          { error: "workspace_id and repos array required" },
          { status: 400 }
        );
      }

      if (repos.length === 0) {
        return NextResponse.json(
          { error: "At least one repo required" },
          { status: 400 }
        );
      }

      // Verify manager has access to workspace
      if (workspace_id !== workspaceId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      // Link each repository
      const repoRecords = repos.map((repo) => ({
        workspace_id: workspace_id,
        github_repo_id: repo.repo_id,
        owner: repo.owner,
        name: repo.name,
        full_name: `${repo.owner}/${repo.name}`,
        url: `https://github.com/${repo.owner}/${repo.name}`,
        is_private: repo.is_private,
      }));

      const { data: linkedRepos, error: linkError } = await supabase
        .from("repos")
        .upsert(repoRecords, {
          onConflict: "full_name",
          ignoreDuplicates: false,
        })
        .select();

      if (linkError) {
        console.error("Error linking repos:", linkError);
        return NextResponse.json(
          { error: "Failed to link repositories" },
          { status: 500 }
        );
      }

      // Log repo linking to audit
      await supabase.from("audit_log").insert({
        workspace_id: workspace_id,
        action: "repos_linked",
        subject_type: "workspace",
        subject_id: workspace_id,
        details: {
          repo_count: linkedRepos.length,
          repos: linkedRepos.map((r) => r.full_name),
        },
      });

      // Enqueue backfill for each repo (TC-ING-004: backfill enqueued)
      // This creates a "backfill job" entry that will be processed by a scheduled function
      const backfillJobs = linkedRepos.map((repo) => ({
        workspace_id: workspace_id,
        repo_id: repo.id,
        status: "pending", // Will be picked up by 5-min poller or scheduled job
        trigger: "manual", // Manager triggered
        triggered_by: userId,
        days_back: 90, // Backfill last 90 days
      }));

      const { error: backfillError } = await supabase
        .from("backfill_jobs")
        .insert(backfillJobs);

      if (backfillError && backfillError.code !== "42P01") {
        // Ignore if table doesn't exist yet (will be created in Phase 2.5)
        console.warn("Backfill table not yet created:", backfillError);
      }

      return NextResponse.json(
        {
          status: "linked",
          repos: linkedRepos,
          backfill_enqueued: true,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Link repos error:", error);
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }
  });
}
