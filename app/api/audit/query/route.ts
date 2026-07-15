import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { queryAuditLog, getAuditSummary, generateComplianceReport } from "@/lib/audit-logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * GET /api/audit/query
 * Query audit log with filters
 * Phase 4.6: Audit logging
 *
 * Query params:
 * - workspaceId: UUID (required)
 * - action?: string
 * - severity?: INFO|NOTICE|WARNING|ERROR|CRITICAL
 * - subjectType?: string
 * - startDate?: YYYY-MM-DD
 * - endDate?: YYYY-MM-DD
 * - limit?: number (default 100, max 1000)
 *
 * Returns: Array of audit log entries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get("workspaceId");
    const action = searchParams.get("action");
    const severity = searchParams.get("severity");
    const subject_type = searchParams.get("subjectType");
    const start_date = searchParams.get("startDate");
    const end_date = searchParams.get("endDate");
    const limit_param = searchParams.get("limit");

    if (!workspace_id) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const limit = Math.min(parseInt(limit_param || "100"), 1000);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const logs = await queryAuditLog(supabase, {
      workspace_id,
      action: action || undefined,
      severity: severity || undefined,
      subject_type: subject_type || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      limit,
    });

    return NextResponse.json({
      status: "ok",
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Audit query endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/audit/summary
 * Get audit summary for date range
 * Phase 4.6: Audit logging
 *
 * Body:
 * {
 *   workspaceId: UUID,
 *   startDate: YYYY-MM-DD,
 *   endDate: YYYY-MM-DD,
 *   reportType?: "summary" | "compliance"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, startDate, endDate, reportType } = body;

    if (!workspaceId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "workspaceId, startDate, endDate required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (reportType === "compliance") {
      const report = await generateComplianceReport(
        supabase,
        workspaceId,
        startDate,
        endDate
      );

      return NextResponse.json({
        status: "ok",
        report_type: "compliance",
        report,
      });
    } else {
      const summary = await getAuditSummary(supabase, workspaceId, startDate, endDate);

      return NextResponse.json({
        status: "ok",
        report_type: "summary",
        summary,
      });
    }
  } catch (error) {
    console.error("Audit summary endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
