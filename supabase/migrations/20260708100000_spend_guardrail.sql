-- Phase 4.5: Spend guardrail and cost tracking
-- Daily cost cap enforcement per workspace
-- Prevent runaway scoring costs

CREATE TABLE daily_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Tracking
  tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cost_cents INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  prs_scored INTEGER DEFAULT 0,
  prs_triage_only INTEGER DEFAULT 0,

  -- Cap enforcement
  daily_cap_cents INTEGER, -- NULL = use global default
  is_capped BOOLEAN DEFAULT FALSE,
  capped_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  reset_by_admin BOOLEAN DEFAULT FALSE,
  reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id, tracking_date)
);

CREATE INDEX idx_daily_cost_tracking_workspace_date ON daily_cost_tracking(workspace_id, tracking_date DESC);
CREATE INDEX idx_daily_cost_tracking_capped ON daily_cost_tracking(is_capped) WHERE is_capped = TRUE;

-- RLS: Managers/admins only
ALTER TABLE daily_cost_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_cost_tracking_admin_only" ON daily_cost_tracking
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = daily_cost_tracking.workspace_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Cost ledger: per-action tracking for audit trail
CREATE TABLE cost_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pr_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,

  -- Cost breakdown
  action TEXT NOT NULL CHECK (action IN ('triage', 'score', 'refetch', 'error_retry')),
  model TEXT NOT NULL, -- 'haiku', 'sonnet', etc.
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  estimated_cost_cents DECIMAL(10,4),

  -- Context
  tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cost_ledger_workspace_date ON cost_ledger(workspace_id, tracking_date DESC);
CREATE INDEX idx_cost_ledger_pr ON cost_ledger(pr_id);

-- RLS: Managers/admins only
ALTER TABLE cost_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_ledger_admin_only" ON cost_ledger
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = cost_ledger.workspace_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Workspace configuration for cost caps
CREATE TABLE workspace_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,

  -- Daily cap in cents (e.g., 50000 = $500)
  daily_cap_cents INTEGER NOT NULL DEFAULT 50000,

  -- Spending strategy
  enable_scoring BOOLEAN NOT NULL DEFAULT TRUE, -- Global kill-switch override
  pause_on_cap BOOLEAN NOT NULL DEFAULT TRUE, -- If TRUE, pause scoring when cap reached
  alert_at_pct_of_cap INTEGER DEFAULT 75, -- Alert when 75% of cap reached

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workspace_cost_config_workspace ON workspace_cost_config(workspace_id);

-- RLS: Admins only
ALTER TABLE workspace_cost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_cost_config_admin_only" ON workspace_cost_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspace_cost_config.workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
