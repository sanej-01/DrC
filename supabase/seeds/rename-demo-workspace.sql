-- Rename the demo workspace to "jotDown Workspace".
-- Run once in the Supabase SQL Editor. Idempotent — safe to re-run.
UPDATE public.workspaces
SET name = 'jotDown Workspace',
    slug = 'jotdown-workspace',
    updated_at = NOW()
WHERE id = 'ws-demo-001';
