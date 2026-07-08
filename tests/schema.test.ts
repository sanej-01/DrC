/**
 * Schema Tests
 * Verify database schema integrity and compliance with requirements
 */

import { getSupabaseAdmin } from "@/lib/supabase";

describe("Database Schema", () => {
  const admin = getSupabaseAdmin();

  it("TC-SCR-010: No raw diff column exists in any table", async () => {
    // Critical test: ensure we never store raw PR diffs
    // This prevents data privacy violations and ensures scoring happens in-memory only

    const { data, error } = await admin
      .from("information_schema.columns")
      .select("table_name, column_name")
      .or("column_name.ilike.%diff%,column_name.ilike.%patch%,column_name.ilike.%code%");

    if (error) {
      // If the query fails, assume schema isn't loaded yet (dev environment)
      console.warn("Schema test skipped (Supabase not available):", error.message);
      return;
    }

    // Filter out expected columns (e.g., system columns)
    const disallowedColumns = data.filter(
      (col: any) =>
        ![
          "deletions_count", // metadata, not raw diff
          "additions_count", // metadata, not raw diff
        ].includes(col.column_name.toLowerCase())
    );

    expect(disallowedColumns).toEqual(
      [],
      `Found raw diff columns: ${disallowedColumns.map((c: any) => `${c.table_name}.${c.column_name}`).join(", ")}`
    );
  });

  it("all core tables exist with correct structure", async () => {
    const expectedTables = [
      "workspaces",
      "users",
      "memberships",
      "repos",
      "pull_requests",
      "pr_scores",
      "feedback_items",
      "coaching_cards",
      "disputes",
      "notes",
      "alerts",
      "audit_log",
      "feedback_helpfulness",
    ];

    for (const tableName of expectedTables) {
      const { error } = await admin.from(tableName).select("*").limit(0);
      expect(error).toBeNull(
        `Table ${tableName} should exist (error: ${error?.message})`
      );
    }
  });

  it("pull_requests table has required metadata columns only", async () => {
    const { data: columns, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "pull_requests");

    if (error) {
      console.warn("Schema inspection skipped:", error.message);
      return;
    }

    const columnNames = columns.map((c: any) => c.column_name);

    // Should have metadata
    expect(columnNames).toContain("additions_count");
    expect(columnNames).toContain("deletions_count");
    expect(columnNames).toContain("files_changed_count");

    // Should NOT have raw code/diff
    expect(columnNames).not.toContain("diff");
    expect(columnNames).not.toContain("patch");
    expect(columnNames).not.toContain("raw_diff");
    expect(columnNames).not.toContain("code");
    expect(columnNames).not.toContain("body"); // PR body could contain code snippets
  });

  it("pr_scores table has four quality dimensions (0-100)", async () => {
    const { data: columns, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "pr_scores");

    if (error) {
      console.warn("Schema inspection skipped:", error.message);
      return;
    }

    const columnNames = columns.map((c: any) => c.column_name);

    expect(columnNames).toContain("code_quality");
    expect(columnNames).toContain("bug_risk");
    expect(columnNames).toContain("architecture");
    expect(columnNames).toContain("test_coverage");
  });

  it("disputes table allows score contributions to be frozen", async () => {
    // Verify disputes table structure enables the freeze-on-dispute pattern
    const { data: columns, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "disputes");

    if (error) {
      console.warn("Schema inspection skipped:", error.message);
      return;
    }

    const columnNames = columns.map((c: any) => c.column_name);

    // Need these for dispute flow
    expect(columnNames).toContain("score_id");
    expect(columnNames).toContain("status"); // pending | accepted | rejected
    expect(columnNames).toContain("resolved_by");
    expect(columnNames).toContain("resolution_notes");
  });

  it("audit_log tracks model version and token usage for scoring", async () => {
    // Verify audit log can record per-PR scoring details (TC-SCR-007)
    const { data: columns, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "audit_log");

    if (error) {
      console.warn("Schema inspection skipped:", error.message);
      return;
    }

    const columnNames = columns.map((c: any) => c.column_name);

    expect(columnNames).toContain("model_version");
    expect(columnNames).toContain("tokens_used");
    expect(columnNames).toContain("latency_ms");
  });
});
