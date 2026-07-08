-- Phase 8.1: Coach panel - live AI coaching queries
-- Developers and managers can ask questions about scores and feedback
-- Server-side model calls with RLS-safe context

CREATE TABLE coach_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_developer_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Question and response
  question TEXT NOT NULL,
  response TEXT,

  -- Model details
  model_name TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT non_empty_question CHECK (length(trim(question)) > 0),
  CONSTRAINT max_question_length CHECK (length(question) <= 1000)
);

CREATE INDEX idx_coach_questions_workspace ON coach_questions(workspace_id);
CREATE INDEX idx_coach_questions_user ON coach_questions(user_id);
CREATE INDEX idx_coach_questions_subject ON coach_questions(subject_developer_id);
CREATE INDEX idx_coach_questions_created ON coach_questions(created_at);
CREATE INDEX idx_coach_questions_workspace_user ON coach_questions(workspace_id, user_id, created_at);

-- RLS: Users can see their own questions and responses
ALTER TABLE coach_questions ENABLE ROW LEVEL SECURITY;

-- Developers can see their own questions
CREATE POLICY "coach_questions_user_own" ON coach_questions
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Managers can see all team questions in their workspace
CREATE POLICY "coach_questions_manager_view" ON coach_questions
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );

-- Users can create questions for themselves
CREATE POLICY "coach_questions_user_create" ON coach_questions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND subject_developer_id = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Managers can create questions for themselves or their team
CREATE POLICY "coach_questions_manager_create" ON coach_questions
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
    AND (
      user_id = auth.uid()
      OR subject_developer_id IN (
        SELECT user_id FROM workspace_members
        WHERE workspace_id = coach_questions.workspace_id
      )
    )
  );

-- Only service role can update responses (from API)
CREATE POLICY "coach_questions_api_update" ON coach_questions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Audit log for coach interactions
CREATE TABLE coach_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  coach_question_id UUID NOT NULL REFERENCES coach_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_developer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'question_asked', 'response_received', 'error'
  context_summary TEXT, -- What data was sent to model (no raw diffs)
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coach_audit_log_workspace ON coach_audit_log(workspace_id);
CREATE INDEX idx_coach_audit_log_question ON coach_audit_log(coach_question_id);

ALTER TABLE coach_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_audit_log_manager_view" ON coach_audit_log
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );
