-- Add merge_commit_sha to pull_requests
--
-- Needed so the poller can tell which commits on the default branch
-- are already covered by a tracked PR (a PR's merge_commit_sha is the
-- commit it produced on the base branch) versus commits that reached
-- main some other way (direct push, or a branch merged locally without
-- ever opening a PR). Without this, once a repo has at least one real
-- PR, the "no PR history" fallback stopped running entirely and other
-- PR-less merges/commits were silently never analyzed.

ALTER TABLE public.pull_requests
  ADD COLUMN IF NOT EXISTS merge_commit_sha TEXT;

SELECT '✅ pull_requests.merge_commit_sha added.' as status;
