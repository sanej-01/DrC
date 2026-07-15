-- Connect the demo workspace to a REAL GitHub repo and token
--
-- Replace the placeholders below, then run in Supabase SQL Editor:
--   YOUR_REAL_TOKEN   -> a GitHub personal access token (repo scope)
--   YOUR_GH_OWNER     -> the repo owner/org, e.g. "octocat"
--   YOUR_GH_REPO_NAME -> the repo name, e.g. "hello-world"

-- 1. scan-github picks up WHICHEVER token row exists first for the
--    workspace (it doesn't filter by user), so remove the other fake
--    demo tokens and keep only one real one - otherwise it's a coin
--    flip whether your real token or a fake one gets used.
DELETE FROM public.github_oauth_tokens
WHERE workspace_id = 'ws-demo-001'
  AND user_id != (SELECT id FROM auth.users WHERE email = 'manager@example.com');

UPDATE public.github_oauth_tokens
SET access_token = 'YOUR_REAL_TOKEN',
    updated_at = NOW()
WHERE workspace_id = 'ws-demo-001'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'manager@example.com');

-- 2. Remove the fake demo repos so the scan only hits your real one
DELETE FROM public.repos WHERE id IN ('repo-demo-001', 'repo-demo-002');

-- 3. Add your real repo (safe to re-run: updates in place if it
--    already exists instead of erroring on the duplicate id)
INSERT INTO public.repos (id, workspace_id, repo_id, owner, name, full_name, description, url, is_active, created_at, updated_at)
VALUES (
  'repo-real-001',
  'ws-demo-001',
  'gh-repo-real-001',
  'YOUR_GH_OWNER',
  'YOUR_GH_REPO_NAME',
  'YOUR_GH_OWNER/YOUR_GH_REPO_NAME',
  'Real repo for testing GitHub scan',
  'https://github.com/YOUR_GH_OWNER/YOUR_GH_REPO_NAME',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  owner = EXCLUDED.owner,
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  url = EXCLUDED.url,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verification
SELECT '🔑 Token now in use:' as status;
SELECT workspace_id, SUBSTRING(access_token, 1, 15) || '...' as token_preview
FROM public.github_oauth_tokens
WHERE workspace_id = 'ws-demo-001';

SELECT '📦 Repos linked:' as status;
SELECT id, full_name FROM public.repos WHERE workspace_id = 'ws-demo-001';
