-- Phase 4.6: Audit logging and compliance trail
-- Immutable, comprehensive audit log for all critical actions
-- SOC2, GDPR, PCI DSS compliance

-- Enhance audit_log table with more structure (already created in Phase 1.1)
-- Add triggers to auto-log key events
-- Create specialized views for compliance reporting

-- Audit action types (comprehensive list for scoring)
CREATE TYPE audit_action AS ENUM (
  -- Scoring actions
  'pr_queued',          -- PR added to scoring_queue
  'pr_triage_started',  -- Haiku triage started
  'pr_triage_completed', -- Haiku triage completed
  'pr_scoring_started', -- Sonnet scoring started
  'pr_scored',          -- PR successfully scored
  'scoring_retry',      -- Retry attempt
  'scoring_failed_exhausted', -- Failed after max retries
  'scoring_failed_permanent', -- Failed with permanent error

  -- Cost and resource tracking
  'cost_logged',        -- Cost recorded
  'cost_cap_reached',   -- Daily cap reached
  'cost_cap_reset',     -- Admin reset cap

  -- Manager alerts and oversight
  'manager_alert_created', -- Manager notified
  'scoring_skipped_empty', -- Empty PR skipped
  'scoring_skipped_draft', -- Draft PR skipped
  'large_pr_detected',  -- Large PR alert

  -- Secret and security
  'secret_detected',    -- Secret found in PR
  'secret_redacted',    -- Secret redacted

  -- Dispute and feedback
  'dispute_created',    -- Developer disputed score
  'dispute_resolved',   -- Manager resolved dispute

  -- Admin and operational
  'admin_action',       -- Admin manual action
  'config_updated',     -- Configuration changed
  'workspace_created'   -- Workspace created
);

-- Audit severity levels
CREATE TYPE audit_severity AS ENUM (
  'INFO',       -- Informational (normal operations)
  'NOTICE',     -- Notable but normal (alerts sent)
  'WARNING',    -- Potential issue (cap approaching)
  'ERROR',      -- Error occurred (retry triggered)
  'CRITICAL'    -- Critical issue (permanent failure, cap reached)
);

-- Audit sources (where the action originated)
CREATE TYPE audit_source AS ENUM (
  'api',           -- REST API endpoint
  'webhook',       -- GitHub webhook
  'poller',        -- 5-minute PR poller
  'backfill',      -- Initial workspace backfill
  'invite_accept', -- Developer invite acceptance
  'admin_panel',   -- Admin interface
  'system',        -- System process
  'cron'           -- Scheduled job
);

-- Main audit log table (enhanced)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core tracking
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  severity audit_severity NOT NULL DEFAULT 'INFO',
  source audit_source NOT NULL DEFAULT 'api',

  -- Subject tracking (what this audit is about)
  subject_type TEXT CHECK (subject_type IN ('pr', 'workspace', 'user', 'config', 'alert', 'dispute')),
  subject_id UUID,

  -- Details (polymorphic JSON for action-specific data)
  details JSONB,

  -- Compliance and forensics
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Immutability markers
  is_immutable BOOLEAN DEFAULT TRUE,
  cannot_delete_reason TEXT,

  -- Timestamps (immutable once created)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Soft-delete only (admin audit trail)
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason TEXT
);

-- Indexes for common queries
CREATE INDEX idx_audit_log_workspace ON audit_log(workspace_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_subject ON audit_log(subject_type, subject_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_severity ON audit_log(severity) WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- RLS: Users can see audit logs for their workspace
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_workspace_access" ON audit_log
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "audit_log_admin_all" ON audit_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = audit_log.workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Audit retention policy table
CREATE TABLE audit_retention_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,

  -- Retention rules (in days)
  retain_logs_days INTEGER NOT NULL DEFAULT 2555, -- 7 years default (SOC2)
  retain_cost_logs_days INTEGER NOT NULL DEFAULT 2555,
  retain_disputes_days INTEGER NOT NULL DEFAULT 2555,
  retain_errors_days INTEGER NOT NULL DEFAULT 2555,

  -- Compliance flags
  require_immutable BOOLEAN NOT NULL DEFAULT TRUE,
  allow_deletion_by_admin BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_retention_workspace ON audit_retention_policy(workspace_id);

-- RLS: Admins only
ALTER TABLE audit_retention_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_retention_policy_admin_only" ON audit_retention_policy
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = audit_retention_policy.workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Audit summary table (for performance on large logs)
CREATE TABLE audit_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Counts by action
  actions_total INTEGER DEFAULT 0,
  actions_pr_scored INTEGER DEFAULT 0,
  actions_scoring_failed INTEGER DEFAULT 0,
  actions_disputes_created INTEGER DEFAULT 0,
  actions_admin_actions INTEGER DEFAULT 0,

  -- Severity breakdown
  severity_critical_count INTEGER DEFAULT 0,
  severity_error_count INTEGER DEFAULT 0,
  severity_warning_count INTEGER DEFAULT 0,

  -- Cost summary
  cost_logged_total_cents INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id, summary_date)
);

CREATE INDEX idx_audit_summary_workspace ON audit_summary(workspace_id, summary_date DESC);

-- RLS: Admins only
ALTER TABLE audit_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_summary_admin_only" ON audit_summary
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = audit_summary.workspace_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
