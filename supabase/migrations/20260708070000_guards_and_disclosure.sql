-- Dr. Codium MVP Phase 3.6 — Guards & File-Level Disclosure
-- Tracks scoring limitations and disclosures
-- Idempotent: uses IF NOT EXISTS

-- ============ PR SCORING ALERTS ============
-- Alerts for scoring limitations (large PR, rate limit, etc.)
CREATE TABLE IF NOT EXISTS pr_scoring_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pr_id UUID NOT NULL UNIQUE REFERENCES pull_requests(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'large_pr', 'empty_diff', 'rate_limit', 'timeout'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'warning', 'error', 'info'
  message TEXT NOT NULL,
  details JSONB, -- Extra context: file_count, diff_size_kb, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_pr_scoring_alerts_pr_id
  ON pr_scoring_alerts(pr_id);

CREATE INDEX IF NOT EXISTS idx_pr_scoring_alerts_type
  ON pr_scoring_alerts(alert_type);

-- No RLS on scoring alerts — internal system table

-- ============ PR FILE TRACKING (Phase 3.6) ============
-- For large PRs, track which files were included/omitted in scoring
-- Helps with transparency: "we scored 45/127 files"
CREATE TABLE IF NOT EXISTS pr_scored_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  included_in_scoring BOOLEAN DEFAULT TRUE, -- true=scored, false=omitted (too large)
  additions INTEGER,
  deletions INTEGER,
  changes INTEGER, -- additions + deletions
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_pr_scored_files_pr_id
  ON pr_scored_files(pr_id);

CREATE INDEX IF NOT EXISTS idx_pr_scored_files_included
  ON pr_scored_files(pr_id, included_in_scoring);

-- No RLS on pr_scored_files — internal system table

-- ============ AUDIT LOGGING FOR GUARDS ============
INSERT INTO audit_log (action, subject_type, details, created_at)
  VALUES ('migration_guards_disclosure', 'system', '{"version": "20260708070000"}', NOW())
  ON CONFLICT DO NOTHING;
