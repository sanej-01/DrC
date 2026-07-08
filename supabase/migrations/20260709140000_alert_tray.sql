-- Phase 6.4: Alert tray for managers
-- Triggers when developer score drops significantly
-- Managers can snooze or dismiss alerts

CREATE TYPE alert_type AS ENUM ('score_drop', 'new_feedback', 'dispute_filed');
CREATE TYPE alert_status AS ENUM ('active', 'snoozed', 'dismissed');

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Alert type and content
  alert_type alert_type NOT NULL DEFAULT 'score_drop',
  title TEXT NOT NULL,
  description TEXT,

  -- Metric that triggered alert
  metric_name TEXT, -- 'score_30d', 'bug_risk', etc.
  metric_old_value DECIMAL(5,2),
  metric_new_value DECIMAL(5,2),
  threshold_delta DECIMAL(5,2), -- e.g., -10 means "dropped by 10 points"

  -- Related entity
  pr_id UUID REFERENCES pull_requests(id) ON DELETE SET NULL,
  coaching_card_id UUID REFERENCES coaching_cards(id) ON DELETE SET NULL,
  dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL,

  -- Status
  status alert_status NOT NULL DEFAULT 'active',

  -- Snooze
  snoozed_until TIMESTAMP WITH TIME ZONE,
  snoozed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Dismissal
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dismissal_reason TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_workspace ON alerts(workspace_id);
CREATE INDEX idx_alerts_manager ON alerts(manager_id);
CREATE INDEX idx_alerts_developer ON alerts(developer_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_workspace_status ON alerts(workspace_id, status);
CREATE INDEX idx_alerts_snoozed_until ON alerts(snoozed_until) WHERE status = 'snoozed';

-- RLS: Managers can only see alerts for their workspace
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_manager_view" ON alerts
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "alerts_manager_modify" ON alerts
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

-- Developers cannot see alerts
CREATE POLICY "alerts_developer_deny" ON alerts
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Alert audit log (for tracking alert lifecycle)
CREATE TABLE alert_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'snoozed', 'dismissed', 'expired')),
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alert_actions_log_alert ON alert_actions_log(alert_id);

ALTER TABLE alert_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_actions_log_manager_view" ON alert_actions_log
  FOR SELECT
  USING (
    alert_id IN (
      SELECT id FROM alerts
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
        AND role IN ('manager', 'admin')
      )
    )
  );
