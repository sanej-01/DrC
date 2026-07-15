-- Fix: github_pr_id overflows the INTEGER type
--
-- GitHub's numeric pull request IDs (e.g. 4060810673) are large enough
-- to exceed Postgres's 32-bit INTEGER range (max 2,147,483,647).
-- pull_requests.github_pr_id was created as plain INTEGER; change it
-- to BIGINT so real GitHub PR IDs can actually be inserted.

ALTER TABLE public.pull_requests
  ALTER COLUMN github_pr_id TYPE BIGINT;

SELECT '✅ github_pr_id is now BIGINT. Re-run the scan.' as status;
