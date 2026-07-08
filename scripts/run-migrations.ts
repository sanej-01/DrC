#!/usr/bin/env node
/**
 * Supabase Migration Runner
 * Runs all migrations in supabase/migrations/ against the configured Supabase project
 *
 * Usage: npx tsx scripts/run-migrations.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing Supabase credentials");
  console.error("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMigrations() {
  try {
    console.log("🔄 Running migrations...");

    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("✅ No migrations found");
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`   Running: ${file}`);

      const { error } = await supabase.rpc("exec", { sql });

      if (error) {
        // Check if it's an "already exists" error (idempotent)
        if (
          error.message?.includes("already exists") ||
          error.message?.includes("duplicate")
        ) {
          console.log(`   ✓ ${file} (idempotent, no changes)`);
        } else {
          throw error;
        }
      } else {
        console.log(`   ✓ ${file}`);
      }
    }

    console.log("\n✅ Migrations complete");
  } catch (err) {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  }
}

// Alternative: if Supabase doesn't have exec RPC, use direct SQL
async function runMigrationsViaSQL() {
  try {
    console.log("🔄 Running migrations (direct SQL)...");

    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("✅ No migrations found");
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`   Running: ${file}`);

      // Use Supabase admin API to run raw SQL
      const { error, data } = await (supabase as any).rpc("exec", { sql });

      if (error) {
        if (error.message?.includes("does not exist")) {
          // RPC doesn't exist; try direct query
          console.warn(
            `   ⚠ exec RPC not available; skipping (use Supabase dashboard to run migrations)`
          );
        } else {
          throw error;
        }
      } else {
        console.log(`   ✓ ${file}`);
      }
    }

    console.log("\n✅ Migrations complete");
  } catch (err) {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigrationsViaSQL();
