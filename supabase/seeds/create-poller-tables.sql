-- Create poller_metadata and poller_job_log
--
-- lib/poller.ts (used by both /api/manager/scan-github and the cron
-- poll-github endpoint) reads/writes these two tables on every scan,
-- but they were never created by any prior seed script. Because
-- Supabase/PostgREST errors are plain objects (not real Error
-- instances), the poller's `error instanceof Error` check silently
-- fell through to a generic "Unknown error" message instead of
-- surfacing "relation does not exist" - this is why Scan GitHub Now
-- showed 0 PRs checked with an unhelpful "Unknown error" even against
-- a real, working GitHub token and repo.

CREATE TABLE IF NOT EXISTS public.poller_metadata (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'polling', 'completed', 'failed')),
  next_poll_at TIMESTAMP WITH TIME ZONE,
  last_poll_at TIMESTAMP WITH TIME ZONE,
  last_fetched_pr_id BIGINT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, repo_id)
);

CREATE TABLE IF NOT EXISTS public.poller_job_log (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  poll_completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  prs_checked INTEGER DEFAULT 0,
  prs_enqueued INTEGER DEFAULT 0,
  prs_duplicated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poller_metadata_workspace_repo
  ON public.poller_metadata(workspace_id, repo_id);
CREATE INDEX IF NOT EXISTS idx_poller_job_log_workspace_id
  ON public.poller_job_log(workspace_id);

SELECT '✅ poller_metadata and poller_job_log created. Try Scan GitHub Now again.' as status;
