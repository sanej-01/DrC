-- Add durable developer profile fields: github_handle and display_name
--
-- Why: PR-to-developer attribution was only ever done via one-time
-- backfill scripts (add-developer-id-to-prs.sql, add-developer-sanej01.sql)
-- that UPDATE existing pull_requests rows. Every scan since then
-- re-inserts (or the poller finds already-tracked rows and skips them,
-- but any newly-created row) pull_requests.developer_id as NULL,
-- because nothing in the app actually knows "this GitHub handle
-- belongs to this developer" at ingestion time - the backfills just
-- hardcoded a one-off SQL match.
--
-- This adds a real, persistent mapping (workspace_members.github_handle)
-- that the poller/webhook can look up on every future PR, plus a
-- display_name so the UI can show a real name instead of falling back
-- to the raw email address.

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS github_handle TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Populate for the existing demo users (same names/handles already
-- established in tests/e2e/fixtures.ts and the earlier one-time backfills)
UPDATE public.workspace_members wm
SET github_handle = 'alice-dev', display_name = 'Developer Alice'
FROM auth.users u
WHERE wm.user_id = u.id AND u.email = 'dev@example.com';

UPDATE public.workspace_members wm
SET github_handle = 'bob-mgr', display_name = 'Manager Bob'
FROM auth.users u
WHERE wm.user_id = u.id AND u.email = 'manager@example.com';

UPDATE public.workspace_members wm
SET github_handle = 'charlie-admin', display_name = 'Admin Charlie'
FROM auth.users u
WHERE wm.user_id = u.id AND u.email = 'admin@example.com';

UPDATE public.workspace_members wm
SET github_handle = 'sanej-01', display_name = 'Sanej Nair'
FROM auth.users u
WHERE wm.user_id = u.id AND u.email = 'sanej.nair@gmail.com';

-- Verification
SELECT '✅ Developer profile fields:' as status;
SELECT
  wm.workspace_id,
  u.email,
  wm.github_handle,
  wm.display_name,
  wm.role
FROM public.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
ORDER BY wm.workspace_id, u.email;
