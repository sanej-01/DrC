-- Dr. Codium MVP Phase 2.4 — Backfill Jobs
-- Tracks PR backfill jobs for repositories and developers
-- Idempotent: uses IF NOT EXISTS

-- ============ BACKFILL JOBS ============
-- Queue for backfill jobs (repo backfill during onboarding, dev backfill during invite)
CREATE TABLE IF NOT EXISTS backfill_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Developer (Phase 2.5)

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  trigger TEXT NOT NULL, -- 'manual' (manager), 'invite' (dev), 'poller' (scheduled)
  triggered_by UUID REFERENCES users(id), -- Who triggered the backfill

  -- Configuration
  days_back INTEGER DEFAULT 90,
  fetched_count INTEGER DEFAULT 0,
  enqueued_count INTEGER DEFAULT 0,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Index for polling
CREATE INDEX IF NOT EXISTS idx_backfill_jobs_workspace_status
  ON backfill_jobs(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_backfill_jobs_user
  ON backfill_jobs(user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_backfill_jobs_repo
  ON backfill_jobs(repo_id)
  WHERE status = 'pending';

-- RLS: Admins and managers can see backfill jobs in their workspace
ALTER TABLE backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY backfill_jobs_select ON backfill_jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('admin', 'manager')
    )
  );

-- ============ AUDIT LOGGING FOR BACKFILL ============
INSERT INTO audit_log (action, subject_type, details, created_at)
  VALUES ('migration_backfill_jobs', 'system', '{"version": "20260708040000"}', NOW())
  ON CONFLICT DO NOTHING;
