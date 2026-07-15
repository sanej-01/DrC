-- Seed script for demo users and workspaces
-- Run this in Supabase SQL Editor to populate test data
--
-- Demo Users:
-- - developer@example.com / Test123!Secure (Developer role)
-- - manager@example.com / Test123!Secure (Manager role)
-- - admin@example.com / Test123!Secure (Admin role)

-- NOTE: Auth users (email/password) must be created via Supabase Auth API
-- This script only seeds the database records

-- Create demo workspaces
INSERT INTO workspaces (id, name, slug, description, created_at, updated_at)
VALUES
  ('ws-demo-001', 'Demo Workspace', 'demo-workspace', 'Demo workspace for testing', NOW(), NOW()),
  ('ws-demo-002', 'Test Team', 'test-team', 'Test team workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create workspace members (map users to workspaces with roles)
-- Assumes auth.users with these emails exist - create them first via Supabase Auth

-- Developer Alice in ws-demo-001
INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'developer', NOW(), NOW()
FROM auth.users
WHERE email = 'dev@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'developer', updated_at = NOW();

-- Manager Bob in ws-demo-001
INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'manager', NOW(), NOW()
FROM auth.users
WHERE email = 'manager@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'manager', updated_at = NOW();

-- Admin Charlie in ws-demo-001 and ws-demo-002
INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'admin', NOW(), NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin', updated_at = NOW();

INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-002', id, 'admin', NOW(), NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin', updated_at = NOW();

-- Create demo GitHub OAuth tokens (optional - for testing GitHub features)
-- These are fake tokens for testing; replace with real ones if needed
INSERT INTO github_oauth_tokens (workspace_id, user_id, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
SELECT 'ws-demo-001', id, 'gho_demo_token_alice_' || substr(md5(random()::text), 1, 16), NULL, 'bearer', NOW() + INTERVAL '1 year', 'repo read:user', NOW(), NOW()
FROM auth.users
WHERE email = 'dev@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO github_oauth_tokens (workspace_id, user_id, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
SELECT 'ws-demo-001', id, 'gho_demo_token_bob_' || substr(md5(random()::text), 1, 16), NULL, 'bearer', NOW() + INTERVAL '1 year', 'repo read:user', NOW(), NOW()
FROM auth.users
WHERE email = 'manager@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO github_oauth_tokens (workspace_id, user_id, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
SELECT 'ws-demo-001', id, 'gho_demo_token_charlie_' || substr(md5(random()::text), 1, 16), NULL, 'bearer', NOW() + INTERVAL '1 year', 'repo read:user', NOW(), NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Verify the setup
SELECT 'Workspaces created:' as status;
SELECT id, name, slug FROM workspaces WHERE id LIKE 'ws-demo-%';

SELECT 'Workspace members created:' as status;
SELECT wm.workspace_id, u.email, wm.role
FROM workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.workspace_id LIKE 'ws-demo-%'
ORDER BY wm.workspace_id, u.email;

SELECT 'GitHub tokens created:' as status;
SELECT workspace_id, (SELECT email FROM auth.users WHERE id = github_oauth_tokens.user_id) as email,
       SUBSTRING(access_token, 1, 20) || '...' as token_preview
FROM github_oauth_tokens
WHERE workspace_id LIKE 'ws-demo-%';
