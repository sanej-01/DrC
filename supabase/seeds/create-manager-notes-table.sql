-- Manager notes: one private, editable note per (workspace, developer).
-- Only managers/admins read or write these (enforced in the API via
-- withManagerAuth + service-role key). Run once in the Supabase SQL
-- Editor. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.manager_notes (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One note per developer per workspace; the API upserts on this.
  UNIQUE (workspace_id, developer_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_notes_workspace_developer
  ON public.manager_notes (workspace_id, developer_id);

-- Access goes through the service-role key in the API, so RLS is enabled
-- with no public policy: PostgREST/anon clients get nothing, the service
-- role bypasses RLS.
ALTER TABLE public.manager_notes ENABLE ROW LEVEL SECURITY;

SELECT '✓ manager_notes table ready' AS status;
