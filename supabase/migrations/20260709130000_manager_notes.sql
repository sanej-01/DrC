-- Phase 6.3: Manager notes (private, manager-only)
-- Managers can add private notes on developers within their workspace
-- Notes are never visible to developers

CREATE TABLE manager_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Note content
  content TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id, developer_id)
);

CREATE INDEX idx_manager_notes_workspace ON manager_notes(workspace_id);
CREATE INDEX idx_manager_notes_developer ON manager_notes(developer_id);
CREATE INDEX idx_manager_notes_manager ON manager_notes(manager_id);
CREATE INDEX idx_manager_notes_workspace_developer ON manager_notes(workspace_id, developer_id);

-- RLS: Only managers in workspace can view/edit notes
ALTER TABLE manager_notes ENABLE ROW LEVEL SECURITY;

-- Managers can see notes for their workspace
CREATE POLICY "manager_notes_manager_view" ON manager_notes
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

-- Managers can create/update notes in their workspace
CREATE POLICY "manager_notes_manager_modify" ON manager_notes
  FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "manager_notes_manager_update" ON manager_notes
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

CREATE POLICY "manager_notes_manager_delete" ON manager_notes
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

-- Developers should never see notes about themselves
CREATE POLICY "manager_notes_developer_deny" ON manager_notes
  FOR ALL
  USING (false)
  WITH CHECK (false);
