-- Fix: Backfill workspace_members and github_oauth_tokens
--
-- Why this is needed: the original demo-users.sql seed script was run
-- BEFORE the auth users (dev@/manager@/admin@example.com) were created
-- in Supabase Authentication. Its INSERT ... SELECT ... FROM auth.users
-- statements matched zero rows at that time (the users didn't exist yet),
-- so they silently inserted nothing. The workspaces table got populated,
-- but workspace_members did not - which is why login succeeds but the
-- app shows "No workspace membership found for your account."
--
-- This script re-runs just the membership + token inserts. Safe to run
-- again even if some rows already exist (ON CONFLICT handles it).

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

-- Demo GitHub OAuth tokens (fake, for testing only)
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

-- Verification
SELECT '👥 Workspace members now:' as status;
SELECT
  wm.workspace_id,
  u.email,
  wm.role
FROM public.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.workspace_id LIKE 'ws-demo-%'
ORDER BY wm.workspace_id, u.email;
