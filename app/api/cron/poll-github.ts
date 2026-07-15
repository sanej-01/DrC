import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pollWorkspacePRs } from "@/lib/poller";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/cron/poll-github
 * Manual GitHub polling endpoint (no automatic scheduling)
 * Phase 3.5: Polls GitHub for missed webhooks (fallback ingestion)
 *
 * MANUAL ONLY: No automatic cron scheduling
 * Trigger manually via curl or admin dashboard
 *
 * Security: Requires CRON_SECRET in Authorization header
 * Usage: POST /api/cron/poll-github
 *        Header: Authorization: Bearer <CRON_SECRET>
 *
 * TC-ING-003 (poller part): Missed webhook recovered, dedup-safe
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Vercel Cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== cronSecret) {
      console.error("Invalid cron secret");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get all workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from("workspaces")
      .select("id");

    if (wsError || !workspaces) {
      console.error("Error fetching workspaces:", wsError);
      return NextResponse.json(
        { error: "Failed to fetch workspaces", details: wsError },
        { status: 500 }
      );
    }

    const pollResults = {
      workspaces_polled: 0,
      repos_polled: 0,
      prs_checked: 0,
      prs_enqueued: 0,
      prs_duplicated: 0,
      errors: [] as string[],
    };

    // Poll each workspace
    for (const workspace of workspaces) {
      try {
        // Get workspace admin's GitHub token for API calls
        // In production, we'd use app-level token or rotate through team members
        const { data: tokenRecord } = await supabase
          .from("github_oauth_tokens")
          .select("access_token")
          .eq("user_id", "*") // Would need proper admin lookup
          .limit(1)
          .maybeSingle();

        if (!tokenRecord?.access_token) {
          console.warn(`No GitHub token found for workspace ${workspace.id}`);
          pollResults.errors.push(
            `No GitHub token for workspace ${workspace.id}`
          );
          continue;
        }

        // Poll all repos in workspace
        const results = await pollWorkspacePRs(
          workspace.id,
          tokenRecord.access_token
        );

        pollResults.workspaces_polled++;
        pollResults.repos_polled += results.length;
        results.forEach((r) => {
          pollResults.prs_checked += r.prs_checked;
          pollResults.prs_enqueued += r.prs_enqueued;
          pollResults.prs_duplicated += r.prs_duplicated;
          if (r.error) {
            pollResults.errors.push(
              `${r.workspace_id}/${r.repo_id}: ${r.error}`
            );
          }
        });
      } catch (wsError) {
        console.error(`Error polling workspace ${workspace.id}:`, wsError);
        pollResults.errors.push(
          `Workspace ${workspace.id}: ${wsError instanceof Error ? wsError.message : "Unknown error"}`
        );
      }
    }

    // Log overall cron run
    console.log("Poller cron run completed:", pollResults);

    return NextResponse.json(pollResults, { status: 200 });
  } catch (error) {
    console.error("Poller cron error:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
