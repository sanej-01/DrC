import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * GET /api/manager/alerts
 * Fetch active and snoozed alerts for manager
 * Query params: workspaceId, limit=10
 */
export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

    const { data, error } = await supabase
      .from("alerts")
      .select(
        `
        *,
        users:developer_id (
          display_name,
          github_handle
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "snoozed"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500 }
      );
    }

    // Move expired snooze alerts back to active in response
    const now = new Date().toISOString();
    const alerts = (data || []).map((alert: any) => {
      if (
        alert.status === "snoozed" &&
        alert.snoozed_until &&
        new Date(alert.snoozed_until) <= new Date(now)
      ) {
        return { ...alert, status: "active" };
      }
      return alert;
    });

    return NextResponse.json({ alerts });
  });
}

/**
 * POST /api/manager/alerts/:action
 * Actions: snooze, dismiss
 * Body: { alert_id, reason? }
 */
export async function POST(request: NextRequest) {
  return withManagerAuth(request, async (req, { userId, workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const body = await request.json();
    const { action, alert_id, reason, minutes } = body;

    if (!action || !alert_id) {
      return NextResponse.json(
        { error: "Missing action or alert_id" },
        { status: 400 }
      );
    }

    if (action === "snooze") {
      const snoozeUntil = new Date(
        new Date().getTime() + (minutes || 1440) * 60000
      ).toISOString();

      const { data, error } = await supabase
        .from("alerts")
        .update({
          status: "snoozed",
          snoozed_until: snoozeUntil,
          snoozed_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alert_id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to snooze alert" },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from("alert_actions_log").insert({
        alert_id,
        action: "snoozed",
        performed_by: userId,
        reason: `Snoozed for ${minutes || 1440} minutes`,
      });

      return NextResponse.json({ alert: data });
    }

    if (action === "dismiss") {
      const { data, error } = await supabase
        .from("alerts")
        .update({
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
          dismissed_by: userId,
          dismissal_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alert_id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to dismiss alert" },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from("alert_actions_log").insert({
        alert_id,
        action: "dismissed",
        performed_by: userId,
        reason,
      });

      return NextResponse.json({ alert: data });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  });
}
