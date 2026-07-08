-- Dr. Codium MVP Phase 1.1 — Core Schema
-- Idempotent: all tables created with IF NOT EXISTS
-- Critical constraint: NO raw PR diffs stored anywhere (TC-SCR-010)

-- ============ WORKSPACES ============
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID NOT NULL UNIQUE, -- Supabase auth user ID
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  github_handle TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ MEMBERSHIPS ============
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'developer',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ============ REPOSITORIES ============
CREATE TABLE IF NOT EXISTS repos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_repo_id BIGINT UNIQUE NOT NULL, -- GitHub's numeric repo ID
  owner TEXT NOT NULL, -- GitHub org or user
  name TEXT NOT NULL, -- repo name
  full_name TEXT UNIQUE NOT NULL, -- owner/repo
  url TEXT NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ PULL REQUESTS ============
-- CRITICAL: Metadata only. NO diff column. NO raw code. Diff processed in-memory.
CREATE TABLE IF NOT EXISTS pull_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,

  -- GitHub metadata
  github_pr_id BIGINT NOT NULL,
  pr_node_id TEXT UNIQUE NOT NULL, -- GraphQL node ID for dedup
  title TEXT NOT NULL,
  number INTEGER NOT NULL,
  url TEXT NOT NULL,

  -- Author
  author_github_handle TEXT NOT NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  merged_at TIMESTAMP NOT NULL, -- Only scored PRs are in this table

  -- Metadata (no diff, no code)
  additions_count INTEGER,
  deletions_count INTEGER,
  files_changed_count INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id, pr_node_id)
);

-- ============ PR SCORES ============
-- Four dimensions: code_quality, bug_risk, architecture, test_coverage (all 0-100)
CREATE TABLE IF NOT EXISTS pr_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID NOT NULL UNIQUE REFERENCES pull_requests(id) ON DELETE CASCADE,

  -- Four quality dimensions (0-100)
  code_quality INTEGER CHECK (code_quality >= 0 AND code_quality <= 100),
  bug_risk INTEGER CHECK (bug_risk >= 0 AND bug_risk <= 100),
  architecture INTEGER CHECK (architecture >= 0 AND architecture <= 100),
  test_coverage INTEGER CHECK (test_coverage >= 0 AND test_coverage <= 100),

  -- Metadata
  scored_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ FEEDBACK ITEMS ============
-- Typed feedback tied to scores (GOOD, IMPROVE, FIX, SUGGEST)
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_id UUID NOT NULL REFERENCES pr_scores(id) ON DELETE CASCADE,

  type feedback_type NOT NULL, -- GOOD | IMPROVE | FIX | SUGGEST
  title TEXT NOT NULL,
  description TEXT,

  -- Code location (if applicable)
  file_path TEXT,
  line_number INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ COACHING CARDS ============
-- Aggregated coaching for a developer per time window
CREATE TABLE IF NOT EXISTS coaching_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  window_start DATE NOT NULL, -- 30/60/90-day window start
  window_days INTEGER NOT NULL, -- 30, 60, or 90

  -- Aggregate scores
  avg_code_quality NUMERIC(5,2),
  avg_bug_risk NUMERIC(5,2),
  avg_architecture NUMERIC(5,2),
  avg_test_coverage NUMERIC(5,2),
  pr_count INTEGER DEFAULT 0,

  -- Confidence badge
  confidence_level TEXT, -- 'high' (>= 3 PRs), 'low' (< 3 PRs)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id, user_id, window_start, window_days)
);

-- ============ DISPUTES ============
-- Developer can dispute a score; manager reviews and accepts/rejects
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_id UUID NOT NULL UNIQUE REFERENCES pr_scores(id) ON DELETE CASCADE,

  -- Who disputed
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Why
  reason TEXT NOT NULL,

  -- Resolution
  status TEXT DEFAULT 'pending', -- pending | accepted | rejected
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ NOTES ============
-- Private manager notes (never visible to developer)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Manager-only
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- About (dev or team)
  about_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ ALERTS ============
-- Action-framed alerts for managers (not surveillance)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Who should see this
  for_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What
  alert_type TEXT NOT NULL, -- score_drop | ready_to_stretch | low_adoption | etc
  about_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Copy
  title TEXT NOT NULL,
  description TEXT,
  action_link TEXT,

  -- Lifecycle
  dismissed_at TIMESTAMP,
  snoozed_until TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ AUDIT LOG ============
-- Complete audit trail (who did what, when, with model version)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Event
  action TEXT NOT NULL, -- pr_scored | dispute_submitted | note_created | etc

  -- Subject
  subject_type TEXT NOT NULL, -- pr | score | dispute | note | etc
  subject_id UUID NOT NULL,

  -- Actor
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role user_role,

  -- Details
  details JSONB,

  -- Scoring specific
  model_version TEXT, -- claude-haiku-4-5, claude-sonnet-5, etc
  tokens_used INTEGER,
  latency_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ FEEDBACK ITEM HELPFULNESS ============
-- Track if developer found feedback helpful (thumbs up/down)
CREATE TABLE IF NOT EXISTS feedback_helpfulness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  helpful BOOLEAN NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- ============ INDEXES ============
-- For common queries
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_repos_workspace ON repos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prs_workspace ON pull_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prs_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_prs_author ON pull_requests(author_user_id);
CREATE INDEX IF NOT EXISTS idx_prs_merged_at ON pull_requests(merged_at);
CREATE INDEX IF NOT EXISTS idx_scores_pr ON pr_scores(pr_id);
CREATE INDEX IF NOT EXISTS idx_feedback_score ON feedback_items(score_id);
CREATE INDEX IF NOT EXISTS idx_coaching_workspace_user ON coaching_cards(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_window ON coaching_cards(window_start, window_days);
CREATE INDEX IF NOT EXISTS idx_disputes_score ON disputes(score_id);
CREATE INDEX IF NOT EXISTS idx_alerts_workspace ON alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_alerts_for_user ON alerts(for_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ============ VALIDATION ============
-- Verify no diff columns exist (SCR-4 critical test)
-- (This will be verified in test/schema.test.ts)

-- Update baseline marker
UPDATE _dr_codium_meta SET value = '1.1.0' WHERE key = 'baseline_version';
