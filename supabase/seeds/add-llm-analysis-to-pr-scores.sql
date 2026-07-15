-- Add storage for the LLM's written analysis and feedback items
--
-- pr_scores currently only stores the 4 numeric dimension scores.
-- The scoring call (routeAndScorePR) also returns a written
-- overall_assessment and a list of typed feedback items
-- (GOOD/IMPROVE/FIX/SUGGEST with title/description/file/line), but
-- nothing has been persisting them - they were being computed and
-- immediately discarded. This adds columns to keep them.

ALTER TABLE public.pr_scores
  ADD COLUMN IF NOT EXISTS overall_assessment TEXT,
  ADD COLUMN IF NOT EXISTS feedback JSONB;

SELECT '✅ pr_scores now stores overall_assessment and feedback. Re-run scoring to populate them for already-scored PRs.' as status;
