-- Add developer_id to pull_requests and backfill demo rows
--
-- Why: garden-stats (and other manager dashboard endpoints) need to
-- attribute a merged PR to a specific auth user to compute per-developer
-- 30-day stats. pull_requests only stored author_github_handle (a
-- string from GitHub) with no link to auth.users. This adds that link
-- and backfills it for the 3 demo PRs seeded earlier.

ALTER TABLE public.pull_requests
  ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pull_requests_developer_id
  ON public.pull_requests(developer_id);

-- Backfill demo PRs based on the github handle -> demo user mapping
-- used in tests/e2e/fixtures.ts
UPDATE public.pull_requests pr
SET developer_id = u.id
FROM auth.users u
WHERE pr.author_github_handle = 'alice-dev' AND u.email = 'dev@example.com';

UPDATE public.pull_requests pr
SET developer_id = u.id
FROM auth.users u
WHERE pr.author_github_handle = 'bob-mgr' AND u.email = 'manager@example.com';

UPDATE public.pull_requests pr
SET developer_id = u.id
FROM auth.users u
WHERE pr.author_github_handle = 'charlie-admin' AND u.email = 'admin@example.com';

-- Verification
SELECT '✅ pull_requests.developer_id backfilled:' as status;
SELECT
  pr.id,
  pr.author_github_handle,
  (SELECT email FROM auth.users WHERE id = pr.developer_id) as developer_email
FROM public.pull_requests pr
ORDER BY pr.number;
