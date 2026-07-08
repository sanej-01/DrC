-- Dr. Codium MVP Phase 4 — Scoring Queue & Results
-- Tracks PR scoring jobs and results
-- Idempotent: uses IF NOT EXISTS

-- ============ SCORING QUEUE ============
-- Queue of PRs waiting to be scored
CREATE TABLE IF NOT EXISTS scoring_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pr_id UUID NOT NULL UNIQUE REFERENCES pull_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, triaging, scoring, completed, failed
  priority INTEGER DEFAULT 0, -- Higher = score first
  attempted_count INTEGER DEFAULT 0, -- Number of scoring attempts
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  scored_at TIMESTAMP
);

-- Index for fast polling
CREATE INDEX IF NOT EXISTS idx_scoring_queue_workspace_status
  ON scoring_queue(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_scoring_queue_priority
  ON scoring_queue(priority DESC)
  WHERE status IN ('pending', 'triaging');

-- No RLS on scoring queue — internal system table

-- ============ SCORING FEEDBACK ============
-- Individual feedback items for a scored PR
CREATE TABLE IF NOT EXISTS scoring_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL, -- GOOD, IMPROVE, FIX, SUGGEST
  dimension TEXT NOT NULL, -- code_quality, bug_risk, architecture, test_coverage
  title TEXT NOT NULL, -- Short feedback title
  description TEXT NOT NULL, -- Detailed description
  severity TEXT, -- low, medium, high (for FIX and IMPROVE)
  file_path TEXT, -- Optional: file path if applicable
  line_number INTEGER, -- Optional: line number if applicable
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_scoring_feedback_pr_id
  ON scoring_feedback(pr_id);

CREATE INDEX IF NOT EXISTS idx_scoring_feedback_type
  ON scoring_feedback(feedback_type, dimension);

-- No RLS on scoring_feedback — internal system table

-- ============ SCORING AUDIT ============
-- Detailed audit of each scoring run (cost, tokens, latency, model version)
CREATE TABLE IF NOT EXISTS scoring_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pr_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  triage_model TEXT, -- Model used for triage (e.g., claude-3-haiku-20240307)
  scoring_model TEXT, -- Model used for scoring (e.g., claude-3-sonnet-20240229)
  triage_tokens_input INTEGER,
  triage_tokens_output INTEGER,
  scoring_tokens_input INTEGER,
  scoring_tokens_output INTEGER,
  triage_latency_ms INTEGER, -- Time for triage
  scoring_latency_ms INTEGER, -- Time for scoring
  total_latency_ms INTEGER, -- Total time
  estimated_cost_cents INTEGER, -- Estimated cost for both calls
  triage_result JSONB, -- Triage output (structured)
  result_hash TEXT, -- Hash of final score for idempotency check
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for cost tracking
CREATE INDEX IF NOT EXISTS idx_scoring_audit_workspace
  ON scoring_audit(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scoring_audit_pr_id
  ON scoring_audit(pr_id);

-- No RLS on scoring_audit — internal system table

-- ============ AUDIT LOGGING FOR SCORING ============
INSERT INTO audit_log (action, subject_type, details, created_at)
  VALUES ('migration_scoring_queue', 'system', '{"version": "20260708080000"}', NOW())
  ON CONFLICT DO NOTHING;
