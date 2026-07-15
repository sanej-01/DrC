-- Add developer "sanej-01" to the demo workspace
--
-- This links an auth user to the workspace as a developer, and
-- attributes any merged PRs authored by the GitHub handle "sanej-01"
-- (the real GitHub account connected via connect-real-github.sql) to
-- that user, so per-developer views (garden-stats, individual drill-down)
-- show their real PR activity.
--
-- Prerequisite: create the auth user first via Supabase Dashboard ->
-- Authentication -> Users, using the email below. If you want a
-- different email, replace every occurrence of it in this file before
-- running.

-- 1. Add workspace membership (role: developer)
INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT 'ws-demo-001', id, 'developer', NOW(), NOW()
FROM auth.users
WHERE email = 'sanej.nair@gmail.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'developer', updated_at = NOW();

-- 2. Attribute merged PRs authored by GitHub handle "sanej-01" to this
--    developer (matches the developer_id backfill pattern used for the
--    other demo users in add-developer-id-to-prs.sql)
UPDATE public.pull_requests pr
SET developer_id = u.id
FROM auth.users u
WHERE pr.author_github_handle = 'sanej-01'
  AND u.email = 'sanej.nair@gmail.com';

-- Verification
SELECT '✅ Workspace membership:' as status;
SELECT wm.workspace_id, u.email, wm.role
FROM public.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE u.email = 'sanej.nair@gmail.com';

SELECT '✅ PRs attributed to sanej-01:' as status;
SELECT
  pr.id,
  pr.number,
  pr.title,
  pr.author_github_handle,
  (SELECT email FROM auth.users WHERE id = pr.developer_id) as developer_email
FROM public.pull_requests pr
WHERE pr.author_github_handle = 'sanej-01';
