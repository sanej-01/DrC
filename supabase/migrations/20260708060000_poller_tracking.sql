-- Dr. Codium MVP Phase 3.5 — Poller Tracking
-- Tracks poller execution for monitoring and debugging
-- Idempotent: uses IF NOT EXISTS

-- ============ POLLER METADATA ============
-- Tracks when poller last ran and status
CREATE TABLE IF NOT EXISTS poller_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  last_poll_at TIMESTAMP,
  next_poll_at TIMESTAMP,
  last_fetched_pr_id BIGINT, -- GitHub PR ID to start from (pagination)
  status TEXT DEFAULT 'idle', -- idle, polling, completed, failed
  error_message TEXT,
  prs_checked INTEGER DEFAULT 0,
  prs_enqueued INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, repo_id)
);

-- Index for poller to find repos to poll
CREATE INDEX IF NOT EXISTS idx_poller_metadata_next_poll
  ON poller_metadata(next_poll_at)
  WHERE status IN ('idle', 'completed');

-- No RLS on poller_metadata — internal system table

-- ============ POLLER JOB LOG ============
-- Detailed log of each poller run
CREATE TABLE IF NOT EXISTS poller_job_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  poll_started_at TIMESTAMP DEFAULT NOW(),
  poll_completed_at TIMESTAMP,
  status TEXT NOT NULL, -- success, partial, failed
  prs_checked INTEGER DEFAULT 0,
  prs_enqueued INTEGER DEFAULT 0,
  prs_duplicated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup by workspace
CREATE INDEX IF NOT EXISTS idx_poller_job_log_workspace
  ON poller_job_log(workspace_id, poll_started_at DESC);

-- No RLS on poller_job_log — internal system table

-- ============ AUDIT LOGGING FOR POLLER ============
INSERT INTO audit_log (action, subject_type, details, created_at)
  VALUES ('migration_poller_tracking', 'system', '{"version": "20260708060000"}', NOW())
  ON CONFLICT DO NOTHING;
