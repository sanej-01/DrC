-- Phase 4.4: Aggregates and low-confidence tracking
-- Compute rolling 30/60/90-day averages for developers per workspace
-- Track scoring volume for confidence determination

CREATE TABLE pr_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 30-day rolling averages
  avg_code_quality_30d DECIMAL(5,2),
  avg_bug_risk_30d DECIMAL(5,2),
  avg_architecture_30d DECIMAL(5,2),
  avg_test_coverage_30d DECIMAL(5,2),
  score_count_30d INTEGER DEFAULT 0,

  -- 60-day rolling averages
  avg_code_quality_60d DECIMAL(5,2),
  avg_bug_risk_60d DECIMAL(5,2),
  avg_architecture_60d DECIMAL(5,2),
  avg_test_coverage_60d DECIMAL(5,2),
  score_count_60d INTEGER DEFAULT 0,

  -- 90-day rolling averages
  avg_code_quality_90d DECIMAL(5,2),
  avg_bug_risk_90d DECIMAL(5,2),
  avg_architecture_90d DECIMAL(5,2),
  avg_test_coverage_90d DECIMAL(5,2),
  score_count_90d INTEGER DEFAULT 0,

  -- Confidence badge: LOW_CONFIDENCE if count < 3, CONFIDENT otherwise
  confidence_badge_30d TEXT DEFAULT 'LOW_CONFIDENCE',
  confidence_badge_60d TEXT DEFAULT 'LOW_CONFIDENCE',
  confidence_badge_90d TEXT DEFAULT 'LOW_CONFIDENCE',

  -- Metadata
  last_computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id, developer_id)
);

CREATE INDEX idx_pr_aggregates_workspace ON pr_aggregates(workspace_id);
CREATE INDEX idx_pr_aggregates_developer ON pr_aggregates(developer_id);
CREATE INDEX idx_pr_aggregates_workspace_developer ON pr_aggregates(workspace_id, developer_id);

-- RLS: Users can only see aggregates for their workspace
ALTER TABLE pr_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_aggregates_workspace_access" ON pr_aggregates
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pr_aggregates_admin_all" ON pr_aggregates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = pr_aggregates.workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Audit log for aggregate computations
CREATE TABLE aggregate_computation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  computation_type TEXT NOT NULL CHECK (computation_type IN ('full', 'partial', 'incremental')),

  -- Scope
  developer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pr_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,

  -- Results
  developers_updated INTEGER DEFAULT 0,
  aggregates_recomputed INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aggregate_computation_log_workspace ON aggregate_computation_log(workspace_id);
CREATE INDEX idx_aggregate_computation_log_status ON aggregate_computation_log(status);

-- RLS: Service role only (internal operations)
ALTER TABLE aggregate_computation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aggregate_computation_log_admin_only" ON aggregate_computation_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = aggregate_computation_log.workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
