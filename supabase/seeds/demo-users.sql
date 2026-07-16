-- Seed script for demo users and workspaces
-- Run this in Supabase SQL Editor to populate test data from scratch
--
-- Demo Users (create these in Auth first):
-- - developer@example.com / Test123!Secure (Developer role)
-- - manager@example.com / Test123!Secure (Manager role)
-- - admin@example.com / Test123!Secure (Admin role)
--
-- This script creates all necessary tables and seeds demo data

-- ============================================================================
-- Create Tables (if they don't exist)
-- ============================================================================

-- Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'developer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- GitHub OAuth tokens table
CREATE TABLE IF NOT EXISTS public.github_oauth_tokens (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'bearer',
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Audit log table (for logging events)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
  ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_github_tokens_workspace_id
  ON public.github_oauth_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_github_tokens_user_id
  ON public.github_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id
  ON public.audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log(created_at);

-- ============================================================================
-- Seed Demo Data
-- ============================================================================

-- Create demo workspaces
INSERT INTO public.workspaces (id, name, slug, description, created_at, updated_at)
VALUES
  ('ws-demo-001', 'jotDown Workspace', 'jotdown-workspace', 'jotDown workspace', NOW(), NOW()),
  ('ws-demo-002', 'Test Team', 'test-team', 'Test team workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create workspace members (map users to workspaces with roles)
-- NOTE: Auth users with these emails must exist - create them first via Supabase Auth dashboard
--       or use the TypeScript seed script: npx ts-node scripts/seed-demo-users.ts

-- Developer Alice in ws-demo-001
INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'developer', NOW(), NOW()
FROM auth.users
WHERE email = 'dev@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'developer', updated_at = NOW();

-- Manager Bob in ws-demo-001
INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'manager', NOW(), NOW()
FROM auth.users
WHERE email = 'manager@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'manager', updated_at = NOW();

-- Admin Charlie in ws-demo-001 and ws-demo-002
INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'admin', NOW(), NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin', updated_at = NOW();

INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-002', id, 'admin', NOW(), NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin', updated_at = NOW();

-- Create demo GitHub OAuth tokens (for testing GitHub features)
-- These are fake tokens for testing; replace with real ones if needed for actual GitHub API calls
INSERT INTO public.github_oauth_tokens (workspace_id, user_id, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
SELECT 'ws-demo-001', id, 'gho_demo_token_alice_' || substr(md5(random()::text), 1, 16), NULL, 'bearer', NOW() + INTERVAL '1 year', 'repo read:user', NOW(), NOW()
FROM auth.users
WHERE email = 'dev@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.github_oauth_tokens (workspace_id, user_id, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
SELECT 'ws-demo-001', id, 'gho_demo_token_bob_' || substr(md5(random()::text), 1, 16), NULL, 'bearer', NOW() + INTERVAL '1 year', 'repo read:user', NOW(), NOW()
FROM auth.users
WHERE email = 'manager@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.github_oauth_tokens (workspace_id, user_id, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
SELECT 'ws-demo-001', id, 'gho_demo_token_charlie_' || substr(md5(random()::text), 1, 16), NULL, 'bearer', NOW() + INTERVAL '1 year', 'repo read:user', NOW(), NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ============================================================================
-- Verification Queries
-- ============================================================================

SELECT '✓ Setup Complete!' as status;
SELECT '';

SELECT '📋 Workspaces created:' as status;
SELECT id, name, slug FROM public.workspaces WHERE id LIKE 'ws-demo-%' ORDER BY id;

SELECT '';
SELECT '👥 Workspace members created:' as status;
SELECT
  wm.workspace_id,
  u.email,
  wm.role,
  TO_CHAR(wm.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM public.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.workspace_id LIKE 'ws-demo-%'
ORDER BY wm.workspace_id, u.email;

SELECT '';
SELECT '🔑 GitHub OAuth tokens created:' as status;
SELECT
  workspace_id,
  (SELECT email FROM auth.users WHERE id = public.github_oauth_tokens.user_id) as user_email,
  SUBSTRING(access_token, 1, 20) || '...' as token_preview,
  TO_CHAR(expires_at, 'YYYY-MM-DD') as expires_at
FROM public.github_oauth_tokens
WHERE workspace_id LIKE 'ws-demo-%'
ORDER BY workspace_id;

SELECT '';
SELECT '✅ All demo data seeded successfully!' as status;
SELECT 'You can now login with:' as info;
SELECT '  • dev@example.com / Test123!Secure (Developer)' as credentials;
SELECT '  • manager@example.com / Test123!Secure (Manager)' as credentials;
SELECT '  • admin@example.com / Test123!Secure (Admin)' as credentials;
