#!/usr/bin/env node
/**
 * Check if baseline migration has been applied
 */

import { getSupabaseAdmin } from "@/lib/supabase";

async function checkMigrations() {
  try {
    console.log("🔍 Checking migration status...");

    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("_dr_codium_meta")
      .select("*")
      .eq("key", "baseline_version")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        console.log(
          "❌ Migrations not applied. Run: npx supabase db push --local"
        );
        console.log("   Or manually run supabase/migrations/20260708000000_baseline.sql");
        process.exit(1);
      }
      throw error;
    }

    console.log(`✅ Baseline migration applied: v${data.value}`);
    console.log(`   Applied at: ${data.created_at}`);
  } catch (err) {
    console.error("❌ Error checking migrations:", err);
    process.exit(1);
  }
}

checkMigrations();
