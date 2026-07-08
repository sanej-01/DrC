-- Dr. Codium MVP Phase 1.2 — Row-Level Security Policies
-- Critical: Enforces privacy boundaries for anti-surveillance design
-- Developers: see only self · Managers: see own team · Cross-tenant: blocked

-- ============ HELPER FUNCTIONS ============

-- Get current user's ID from auth
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL STABLE;

-- Get current user's workspace ID (from memberships)
CREATE OR REPLACE FUNCTION current_workspace_id() RETURNS UUID AS $$
  SELECT workspace_id FROM memberships
  WHERE user_id = auth.user_id()
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Get current user's role in a workspace
CREATE OR REPLACE FUNCTION user_role_in_workspace(workspace_id UUID) RETURNS user_role AS $$
  SELECT role FROM memberships
  WHERE user_id = auth.user_id()
  AND memberships.workspace_id = $1
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============ WORKSPACES ============
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
    )
  );

CREATE POLICY workspaces_admin_all ON workspaces FOR ALL
  USING (
    id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    )
  );

-- ============ USERS ============
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can see themselves; managers/admins can see team members
CREATE POLICY users_self ON users FOR SELECT
  USING (
    id = auth.user_id()
    OR id IN (
      SELECT m2.user_id FROM memberships m1
      JOIN memberships m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_id = auth.user_id()
      AND m1.role IN ('manager', 'admin')
    )
  );

-- Users can update their own profile
CREATE POLICY users_update_self ON users FOR UPDATE
  USING (id = auth.user_id())
  WITH CHECK (id = auth.user_id());

-- ============ MEMBERSHIPS ============
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Users can see their own membership; managers/admins can see team
CREATE POLICY memberships_select ON memberships FOR SELECT
  USING (
    user_id = auth.user_id()
    OR workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('manager', 'admin')
    )
  );

-- Only admins can insert memberships
CREATE POLICY memberships_insert ON memberships FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    )
  );

-- Only admins can update memberships
CREATE POLICY memberships_update ON memberships FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    )
  );

-- ============ REPOSITORIES ============
ALTER TABLE repos ENABLE ROW LEVEL SECURITY;

-- Users can see repos in their workspaces
CREATE POLICY repos_select ON repos FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
    )
  );

-- Only admins can manage repos
CREATE POLICY repos_insert ON repos FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    )
  );

-- ============ PULL REQUESTS ============
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;

-- All team members can see PRs in their workspace
CREATE POLICY prs_select ON pull_requests FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
    )
  );

-- System/scoring service inserts PRs (via service role)
CREATE POLICY prs_insert ON pull_requests FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('admin')
    ) OR current_user = 'service_role'
  );

-- ============ PR SCORES ============
ALTER TABLE pr_scores ENABLE ROW LEVEL SECURITY;

-- All team members can see scores in their workspace
CREATE POLICY scores_select ON pr_scores FOR SELECT
  USING (
    pr_id IN (
      SELECT id FROM pull_requests
      WHERE workspace_id IN (
        SELECT workspace_id FROM memberships
        WHERE user_id = auth.user_id()
      )
    )
  );

-- System/scoring service inserts scores
CREATE POLICY scores_insert ON pr_scores FOR INSERT
  WITH CHECK (
    pr_id IN (
      SELECT id FROM pull_requests
      WHERE workspace_id IN (
        SELECT workspace_id FROM memberships
        WHERE user_id = auth.user_id()
        AND role = 'admin'
      )
    ) OR current_user = 'service_role'
  );

-- ============ FEEDBACK ITEMS ============
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;

-- All team members can see feedback in their workspace
CREATE POLICY feedback_select ON feedback_items FOR SELECT
  USING (
    score_id IN (
      SELECT id FROM pr_scores
      WHERE pr_id IN (
        SELECT id FROM pull_requests
        WHERE workspace_id IN (
          SELECT workspace_id FROM memberships
          WHERE user_id = auth.user_id()
        )
      )
    )
  );

-- ============ COACHING CARDS ============
ALTER TABLE coaching_cards ENABLE ROW LEVEL SECURITY;

-- Developers see only their own coaching cards
-- Managers see their team's coaching cards
CREATE POLICY coaching_select ON coaching_cards FOR SELECT
  USING (
    (user_id = auth.user_id())
    OR
    (workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('manager', 'admin')
    ))
  );

-- ============ DISPUTES ============
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Developers see disputes on their own PRs
-- Managers see all disputes in their team
CREATE POLICY disputes_select ON disputes FOR SELECT
  USING (
    score_id IN (
      SELECT id FROM pr_scores
      WHERE pr_id IN (
        SELECT id FROM pull_requests
        WHERE workspace_id IN (
          SELECT workspace_id FROM memberships
          WHERE user_id = auth.user_id()
        )
        AND (
          author_user_id = auth.user_id()
          OR workspace_id IN (
            SELECT workspace_id FROM memberships
            WHERE user_id = auth.user_id()
            AND role IN ('manager', 'admin')
          )
        )
      )
    )
  );

-- Developers can insert disputes on their own scores
CREATE POLICY disputes_insert ON disputes FOR INSERT
  WITH CHECK (
    score_id IN (
      SELECT id FROM pr_scores
      WHERE pr_id IN (
        SELECT id FROM pull_requests
        WHERE author_user_id = auth.user_id()
      )
    )
  );

-- Managers/admins can update disputes
CREATE POLICY disputes_update ON disputes FOR UPDATE
  USING (
    score_id IN (
      SELECT id FROM pr_scores
      WHERE pr_id IN (
        SELECT id FROM pull_requests
        WHERE workspace_id IN (
          SELECT workspace_id FROM memberships
          WHERE user_id = auth.user_id()
          AND role IN ('manager', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    score_id IN (
      SELECT id FROM pr_scores
      WHERE pr_id IN (
        SELECT id FROM pull_requests
        WHERE workspace_id IN (
          SELECT workspace_id FROM memberships
          WHERE user_id = auth.user_id()
          AND role IN ('manager', 'admin')
        )
      )
    )
  );

-- ============ NOTES (PRIVATE TO MANAGERS) ============
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Notes are visible ONLY to the author and admins
-- Developers NEVER see notes about them
CREATE POLICY notes_select ON notes FOR SELECT
  USING (
    (author_id = auth.user_id())
    OR
    (workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    ))
  );

-- Only managers/admins in the workspace can create notes
CREATE POLICY notes_insert ON notes FOR INSERT
  WITH CHECK (
    author_id = auth.user_id()
    AND workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('manager', 'admin')
    )
  );

-- Only the author (or admin) can update their notes
CREATE POLICY notes_update ON notes FOR UPDATE
  USING (
    (author_id = auth.user_id())
    OR
    (workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    ))
  )
  WITH CHECK (
    (author_id = auth.user_id())
    OR
    (workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role = 'admin'
    ))
  );

-- ============ ALERTS ============
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users see alerts directed to them
-- Managers/admins see alerts in their workspace
CREATE POLICY alerts_select ON alerts FOR SELECT
  USING (
    (for_user_id = auth.user_id())
    OR
    (workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('manager', 'admin')
    ))
  );

-- Only system (service_role) creates alerts
CREATE POLICY alerts_insert ON alerts FOR INSERT
  WITH CHECK (current_user = 'service_role');

-- ============ AUDIT LOG ============
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can see full audit log
-- Managers can see actions in their workspace
CREATE POLICY audit_select ON audit_log FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.user_id()
      AND role IN ('manager', 'admin')
    )
  );

-- Only system inserts audit entries
CREATE POLICY audit_insert ON audit_log FOR INSERT
  WITH CHECK (current_user = 'service_role');

-- ============ FEEDBACK HELPFULNESS ============
ALTER TABLE feedback_helpfulness ENABLE ROW LEVEL SECURITY;

-- Users can see helpfulness votes on feedback they can see
CREATE POLICY helpfulness_select ON feedback_helpfulness FOR SELECT
  USING (
    feedback_id IN (
      SELECT id FROM feedback_items
      WHERE score_id IN (
        SELECT id FROM pr_scores
        WHERE pr_id IN (
          SELECT id FROM pull_requests
          WHERE workspace_id IN (
            SELECT workspace_id FROM memberships
            WHERE user_id = auth.user_id()
          )
        )
      )
    )
  );

-- Users can insert/update their own helpfulness votes
CREATE POLICY helpfulness_insert ON feedback_helpfulness FOR INSERT
  WITH CHECK (user_id = auth.user_id());

CREATE POLICY helpfulness_update ON feedback_helpfulness FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

-- ============ VERIFICATION ============
-- Update baseline marker
UPDATE _dr_codium_meta SET value = '1.2.0' WHERE key = 'baseline_version';
