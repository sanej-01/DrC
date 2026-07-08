-- Phase 8.2: VP rollup - organization and team composite views
-- Read-only portfolio for executives: team aggregates, early-warning cards

CREATE TABLE team_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,

  -- 30-day team metrics (average across developers)
  avg_code_quality_30d DECIMAL(5,2),
  avg_bug_risk_30d DECIMAL(5,2),
  avg_architecture_30d DECIMAL(5,2),
  avg_test_coverage_30d DECIMAL(5,2),
  overall_score_30d DECIMAL(5,2),

  -- 60-day metrics
  avg_code_quality_60d DECIMAL(5,2),
  avg_bug_risk_60d DECIMAL(5,2),
  avg_architecture_60d DECIMAL(5,2),
  avg_test_coverage_60d DECIMAL(5,2),
  overall_score_60d DECIMAL(5,2),

  -- 90-day metrics
  avg_code_quality_90d DECIMAL(5,2),
  avg_bug_risk_90d DECIMAL(5,2),
  avg_architecture_90d DECIMAL(5,2),
  avg_test_coverage_90d DECIMAL(5,2),
  overall_score_90d DECIMAL(5,2),

  -- Team stats
  developer_count INTEGER DEFAULT 0,
  total_prs_30d INTEGER DEFAULT 0,
  trend TEXT, -- 'improving', 'stable', 'declining'

  -- Last computed
  last_computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id, team_name)
);

CREATE INDEX idx_team_aggregates_workspace ON team_aggregates(workspace_id);
CREATE INDEX idx_team_aggregates_trend ON team_aggregates(trend);
CREATE INDEX idx_team_aggregates_overall_score ON team_aggregates(overall_score_30d);

-- RLS: Managers and admins can view team aggregates in their workspace
ALTER TABLE team_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_aggregates_view" ON team_aggregates
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

-- Early warning alerts for declining teams
CREATE TABLE early_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id UUID REFERENCES team_aggregates(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,

  -- Alert type
  warning_type TEXT NOT NULL CHECK (warning_type IN ('score_drop', 'low_velocity', 'quality_risk', 'retention_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  metric_name TEXT,
  threshold_value DECIMAL(5,2),
  actual_value DECIMAL(5,2),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_early_warnings_workspace ON early_warnings(workspace_id);
CREATE INDEX idx_early_warnings_team ON early_warnings(team_id);
CREATE INDEX idx_early_warnings_status ON early_warnings(status);
CREATE INDEX idx_early_warnings_severity ON early_warnings(severity);

-- RLS: Managers and admins can view early warnings in their workspace
ALTER TABLE early_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "early_warnings_view" ON early_warnings
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "early_warnings_acknowledge" ON early_warnings
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

-- Workspace overview snapshot (for VP dashboard summary)
CREATE TABLE workspace_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Organization totals
  total_developers INTEGER,
  total_teams INTEGER,
  total_prs_30d INTEGER,
  avg_score_30d DECIMAL(5,2),

  -- Health indicators
  teams_improving INTEGER,
  teams_stable INTEGER,
  teams_declining INTEGER,
  critical_warnings INTEGER,

  -- Trend
  trend TEXT, -- 'improving', 'stable', 'declining'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workspace_snapshots_workspace ON workspace_snapshots(workspace_id);
CREATE INDEX idx_workspace_snapshots_created ON workspace_snapshots(created_at);

ALTER TABLE workspace_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_snapshots_view" ON workspace_snapshots
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );
