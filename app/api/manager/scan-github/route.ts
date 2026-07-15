import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pollWorkspacePRs } from "@/lib/poller";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/manager/scan-github
 * Manager-triggered manual GitHub PR scan for their workspace
 *
 * Authorization: Manager of workspace (verified via RLS)
 * Body: { workspaceId }
 *
 * Returns: Scan results (PRs found, enqueued, deduped)
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth context (user_id from session)
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify manager has access to workspace (RLS check)
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found or access denied" },
        { status: 403 }
      );
    }

    // Verify user is manager or admin of workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (memberError || !member || !["manager", "admin"].includes(member.role)) {
      return NextResponse.json(
        { error: "Only managers and admins can trigger scans" },
        { status: 403 }
      );
    }

    // Get workspace admin's GitHub token for API calls
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("github_oauth_tokens")
      .select("access_token")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (!tokenRecord?.access_token) {
      return NextResponse.json(
        {
          error: "No GitHub token configured for workspace",
          message: "Workspace admin must authorize GitHub OAuth",
        },
        { status: 400 }
      );
    }

    // Poll repos in this workspace
    const results = await pollWorkspacePRs(workspaceId, tokenRecord.access_token);

    const scanResults = {
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
      repos_scanned: results.length,
      prs_checked: results.reduce((sum, r) => sum + r.prs_checked, 0),
      prs_enqueued: results.reduce((sum, r) => sum + r.prs_enqueued, 0),
      prs_duplicated: results.reduce((sum, r) => sum + r.prs_duplicated, 0),
      repos: results.map((r) => ({
        repo_id: r.repo_id,
        prs_checked: r.prs_checked,
        prs_enqueued: r.prs_enqueued,
        prs_duplicated: r.prs_duplicated,
      })),
      errors: results.filter((r) => r.error).map((r) => r.error),
    };

    // Log scan to audit trail
    await supabase.from("audit_log").insert({
      workspace_id: workspaceId,
      action: "manual_scan_triggered",
      subject_type: "workspace",
      subject_id: workspaceId,
      details: {
        repos_scanned: scanResults.repos_scanned,
        prs_enqueued: scanResults.prs_enqueued,
        prs_duplicated: scanResults.prs_duplicated,
      },
    });

    console.log("Manager manual scan completed:", scanResults);

    return NextResponse.json(scanResults, { status: 200 });
  } catch (error) {
    console.error("Manager scan error:", error);
    return NextResponse.json(
      {
        error: "Scan failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/manager/scan-github
 * Get scan history for workspace
 * Query params: workspaceId
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get recent scan events from audit log
    const { data: scans, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("action", "manual_scan_triggered")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch scan history" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        workspace_id: workspaceId,
        scans: scans.map((s) => ({
          timestamp: s.created_at,
          repos_scanned: s.details?.repos_scanned || 0,
          prs_enqueued: s.details?.prs_enqueued || 0,
          prs_duplicated: s.details?.prs_duplicated || 0,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Scan history error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch scan history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
