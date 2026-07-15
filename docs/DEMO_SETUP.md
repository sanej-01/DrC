# Demo User Setup Guide

This guide explains how to set up demo users and workspaces for local testing and development.

---

## Overview

Demo credentials (from `tests/e2e/fixtures.ts`):

| Role | Email | Password | GitHub Handle |
|------|-------|----------|---------------|
| **Developer** | dev@example.com | Test123!Secure | alice-dev |
| **Manager** | manager@example.com | Test123!Secure | bob-mgr |
| **Admin** | admin@example.com | Test123!Secure | charlie-admin |

---

## Setup Steps

### Step 1: Create Auth Users in Supabase

Auth users must be created first. Choose one method:

#### Option A: Supabase Dashboard (Manual)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** → **Users**
4. Click **Add user**
5. Create each demo user:
   - dev@example.com / Test123!Secure
   - manager@example.com / Test123!Secure
   - admin@example.com / Test123!Secure
6. Enable email confirmation for each

#### Option B: Admin API (Automated)
Use the TypeScript seed script (see Step 3 below) which includes user creation via the Admin API.

---

### Step 2: Seed Database Records

Choose one method to create workspaces and memberships:

#### Option A: SQL Script (Quick)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `supabase/seeds/demo-users.sql`
4. Paste into the SQL editor
5. Click **Run**
6. Verify the output shows workspaces and members created

**Output should show:**
```
Workspaces created:
ws-demo-001 | Demo Workspace | demo-workspace
ws-demo-002 | Test Team | test-team

Workspace members created:
ws-demo-001 | dev@example.com | developer
ws-demo-001 | manager@example.com | manager
ws-demo-001 | admin@example.com | admin
ws-demo-002 | admin@example.com | admin

GitHub tokens created:
(tokens listed)
```

#### Option B: TypeScript Script (Programmatic)

1. Set environment variables:
```bash
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

2. Run the seed script:
```bash
npx ts-node scripts/seed-demo-users.ts
```

3. The script will:
   - Create or verify auth users exist
   - Create workspaces
   - Create workspace members
   - Create GitHub OAuth tokens (fake, for testing)

---

## Verify Setup

### Check via Supabase Dashboard

1. **Workspaces**: SQL Editor → `SELECT * FROM workspaces WHERE id LIKE 'ws-demo-%'`
2. **Members**: SQL Editor → 
   ```sql
   SELECT wm.workspace_id, u.email, wm.role
   FROM workspace_members wm
   JOIN auth.users u ON wm.user_id = u.id
   WHERE wm.workspace_id LIKE 'ws-demo-%'
   ```
3. **Tokens**: SQL Editor → `SELECT * FROM github_oauth_tokens WHERE workspace_id LIKE 'ws-demo-%'`

### Test Login

1. Start the local app: `npm run dev`
2. Go to http://localhost:3000/auth/sign-in
3. Login with any demo user:
   - dev@example.com / Test123!Secure
   - manager@example.com / Test123!Secure
   - admin@example.com / Test123!Secure

---

## Workspaces & Roles

### Demo Workspace (ws-demo-001)

**Members:**
- **Developer Alice** (dev@example.com) — Can see their own scores, view dashboard
- **Manager Bob** (manager@example.com) — Can manage team, trigger scans, view reports
- **Admin Charlie** (admin@example.com) — Full access to all features

**Purpose:** Main workspace for testing all user roles and features

### Test Team (ws-demo-002)

**Members:**
- **Admin Charlie** (admin@example.com) — Full access

**Purpose:** Secondary workspace for testing multi-workspace scenarios

---

## Resetting Demo Data

### Option A: Delete and Recreate

1. Delete all demo data:
```sql
DELETE FROM workspace_members WHERE workspace_id LIKE 'ws-demo-%';
DELETE FROM github_oauth_tokens WHERE workspace_id LIKE 'ws-demo-%';
DELETE FROM workspaces WHERE id LIKE 'ws-demo-%';
```

2. Re-run the SQL seed script (Step 2, Option A)

### Option B: Delete Auth Users (Complete Reset)

If you need to delete everything including auth users:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find each demo user and click the **...** menu
3. Click **Delete user**
4. Confirm deletion
5. Re-run both setup steps above

---

## Testing Different Roles

### Developer View
- Login: dev@example.com / Test123!Secure
- Access: /dashboard (personal scores and coaching)
- Limited to: Own workspace, own PR scores

### Manager View
- Login: manager@example.com / Test123!Secure
- Access: /manager/team (team dashboard, manual scans)
- Can: View team performance, trigger manual scans, see team reports

### Admin View
- Login: admin@example.com / Test123!Secure
- Access: Full access to all features
- Can: Manage workspace, invite users, configure GitHub App

---

## GitHub OAuth Tokens

The seed scripts create **fake GitHub tokens** for testing. These are not real GitHub tokens and will fail if you try to use them with the actual GitHub API.

### For Real Testing:

1. Authorize a real GitHub account via the app's OAuth flow
2. This will create real tokens in the `github_oauth_tokens` table
3. Or manually create test tokens in the Supabase dashboard:
```sql
INSERT INTO github_oauth_tokens (
  workspace_id, user_id, access_token, token_type, scope, expires_at
)
VALUES (
  'ws-demo-001',
  (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
  'gho_YOUR_REAL_GITHUB_TOKEN',
  'bearer',
  'repo read:user',
  NOW() + INTERVAL '1 year'
);
```

---

## Troubleshooting

### "User not found" error
- **Cause**: Auth user wasn't created before running seed script
- **Fix**: Create the auth user manually in Supabase dashboard first

### "Workspace already exists" error
- **Cause**: Workspace with that ID already exists
- **Fix**: Either delete it first or use different workspace IDs

### Login fails with demo credentials
- **Cause**: Auth user wasn't email-confirmed
- **Fix**: In Supabase dashboard, find the user and enable email confirmation

### Can't see workspaces after login
- **Cause**: Workspace membership not created
- **Fix**: Check `workspace_members` table has the correct user_id and workspace_id mapping

### Getting "workspace not found" errors
- **Cause**: Using wrong workspace ID in the app
- **Fix**: Verify workspace IDs are `ws-demo-001` or `ws-demo-002`

---

## CI/CD Automation

### GitHub Actions

To automatically seed demo data in CI:

```yaml
name: Seed Demo Data
on:
  workflow_dispatch:  # Manual trigger

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npx ts-node scripts/seed-demo-users.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Local Testing

Before committing, run the seed script to ensure demo data is set up:

```bash
npx ts-node scripts/seed-demo-users.ts
npm run dev
# Test login with dev@example.com / Test123!Secure
```

---

## See Also

- [MANUAL_SCANNING.md](./MANUAL_SCANNING.md) — Manager scan feature guide
- [MANAGER_MANUAL_SCAN.md](./MANAGER_MANUAL_SCAN.md) — Manager UI/UX guide
- [OPENROUTER_MIGRATION.md](./OPENROUTER_MIGRATION.md) — LLM setup guide
