#!/usr/bin/env node

/**
 * Seed demo users and workspaces for local testing
 *
 * Usage:
 *   npx ts-node scripts/seed-demo-users.ts
 *
 * Prerequisites:
 * 1. Create auth users first via Supabase dashboard or script
 * 2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 3. Run this script to populate database records
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DEMO_USERS = [
  {
    email: "dev@example.com",
    password: "Test123!Secure",
    name: "Developer Alice",
    githubHandle: "alice-dev",
  },
  {
    email: "manager@example.com",
    password: "Test123!Secure",
    name: "Manager Bob",
    githubHandle: "bob-mgr",
  },
  {
    email: "admin@example.com",
    password: "Test123!Secure",
    name: "Admin Charlie",
    githubHandle: "charlie-admin",
  },
];

const DEMO_WORKSPACES = [
  {
    id: "ws-demo-001",
    name: "Demo Workspace",
    slug: "demo-workspace",
    description: "Demo workspace for testing",
  },
  {
    id: "ws-demo-002",
    name: "Test Team",
    slug: "test-team",
    description: "Test team workspace",
  },
];

const WORKSPACE_MEMBERS = [
  { workspaceId: "ws-demo-001", email: "dev@example.com", role: "developer" },
  { workspaceId: "ws-demo-001", email: "manager@example.com", role: "manager" },
  { workspaceId: "ws-demo-001", email: "admin@example.com", role: "admin" },
  { workspaceId: "ws-demo-002", email: "admin@example.com", role: "admin" },
];

async function seedDemoData() {
  console.log("🌱 Seeding demo users and workspaces...\n");

  try {
    // Step 1: Create auth users
    console.log("📝 Step 1: Creating auth users...");
    const createdUsers: Record<string, string> = {};

    for (const user of DEMO_USERS) {
      try {
        // Check if user exists
        const { data: existingUser } = await supabase.auth.admin.getUserById("");

        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });

        if (error) {
          // User might already exist, try to get them
          const { data: existingData, error: getError } =
            await supabase.auth.admin.listUsers();

          if (getError) {
            console.warn(`   ⚠️  Could not create/find user ${user.email}: ${error.message}`);
            continue;
          }

          const foundUser = existingData?.users?.find(
            (u) => u.email === user.email
          );
          if (foundUser) {
            createdUsers[user.email] = foundUser.id;
            console.log(`   ✓ User already exists: ${user.email}`);
          }
        } else if (data?.user) {
          createdUsers[user.email] = data.user.id;
          console.log(`   ✓ Created user: ${user.email}`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Error creating user ${user.email}:`, err instanceof Error ? err.message : String(err));
      }
    }

    if (Object.keys(createdUsers).length === 0) {
      console.error("\n❌ No users created or found. Cannot continue.");
      console.log("\n📋 To create users manually via Supabase dashboard:");
      console.log("   1. Go to Supabase dashboard → Authentication → Users");
      console.log("   2. Click 'Add user'");
      DEMO_USERS.forEach((u) => {
        console.log(`   3. Create: ${u.email} / ${u.password}`);
      });
      process.exit(1);
    }

    // Step 2: Create workspaces
    console.log("\n🏢 Step 2: Creating workspaces...");
    for (const workspace of DEMO_WORKSPACES) {
      const { error } = await supabase.from("workspaces").insert({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes("duplicate")) {
        console.warn(`   ⚠️  Error creating workspace ${workspace.id}:`, error.message);
      } else {
        console.log(`   ✓ Workspace created: ${workspace.name} (${workspace.id})`);
      }
    }

    // Step 3: Create workspace members
    console.log("\n👥 Step 3: Creating workspace members...");
    for (const member of WORKSPACE_MEMBERS) {
      const userId = createdUsers[member.email];
      if (!userId) {
        console.warn(`   ⚠️  User ${member.email} not found, skipping membership`);
        continue;
      }

      const { error } = await supabase.from("workspace_members").insert({
        workspace_id: member.workspaceId,
        user_id: userId,
        role: member.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes("duplicate")) {
        console.warn(
          `   ⚠️  Error creating membership (${member.email} → ${member.workspaceId}):`,
          error.message
        );
      } else {
        console.log(
          `   ✓ Member added: ${member.email} as ${member.role} in ${member.workspaceId}`
        );
      }
    }

    // Step 4: Create GitHub OAuth tokens (fake tokens for testing)
    console.log("\n🔑 Step 4: Creating GitHub OAuth tokens (for testing)...");
    for (const user of DEMO_USERS) {
      const userId = createdUsers[user.email];
      if (!userId) continue;

      const fakeToken = `gho_demo_${user.githubHandle}_${Math.random().toString(36).substring(7)}`;

      const { error } = await supabase.from("github_oauth_tokens").insert({
        workspace_id: "ws-demo-001",
        user_id: userId,
        access_token: fakeToken,
        token_type: "bearer",
        scope: "repo read:user",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes("duplicate")) {
        console.warn(
          `   ⚠️  Error creating token for ${user.email}:`,
          error.message
        );
      } else {
        console.log(`   ✓ Token created for: ${user.email}`);
      }
    }

    // Summary
    console.log("\n✨ Demo data seeding complete!\n");
    console.log("📝 Demo Users:");
    console.log("   Developer: dev@example.com / Test123!Secure");
    console.log("   Manager:   manager@example.com / Test123!Secure");
    console.log("   Admin:     admin@example.com / Test123!Secure");
    console.log("\n🏢 Workspaces:");
    console.log("   ws-demo-001 (Demo Workspace)");
    console.log("   ws-demo-002 (Test Team)");
    console.log("\n✅ You can now login with these credentials locally!");
  } catch (error) {
    console.error("\n❌ Seeding failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

seedDemoData();
