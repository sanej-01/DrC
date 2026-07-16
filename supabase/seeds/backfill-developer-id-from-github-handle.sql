-- Backfill pull_requests.developer_id from workspace_members.github_handle
--
-- Why: add-developer-profile-fields.sql added a durable github_handle ->
-- user_id mapping on workspace_members, and lib/poller.ts's
-- resolveDeveloperId() now uses it to set developer_id on every *new*
-- PR at scan/webhook time. But pull_requests rows ingested before that
-- fix (e.g. sanej-01's PR #1 and the general-review row for
-- sanej.nair@gmail.com) still have developer_id = NULL, so
-- garden-stats has nothing to attribute to them and Team Garden shows
-- "No PRs" even though the PRs exist and are scored.
--
-- Safe to re-run: only touches rows where developer_id IS NULL.

UPDATE public.pull_requests pr
SET developer_id = wm.user_id
FROM public.workspace_members wm
WHERE pr.author_github_handle = wm.github_handle
  AND pr.workspace_id = wm.workspace_id
  AND pr.developer_id IS NULL;

-- Verification
SELECT '✅ pull_requests.developer_id backfilled from github_handle:' as status;
SELECT
  pr.id,
  pr.number,
  pr.author_github_handle,
  pr.workspace_id,
  (SELECT email FROM auth.users WHERE id = pr.developer_id) as developer_email
FROM public.pull_requests pr
ORDER BY pr.workspace_id, pr.number;
