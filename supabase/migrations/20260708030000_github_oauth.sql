-- Dr. Codium MVP Phase 2.3 — GitHub OAuth Tokens
-- Secure storage for GitHub OAuth tokens (distinct from webhook GitHub App)
-- Idempotent: uses IF NOT EXISTS

-- ============ GITHUB OAUTH TOKENS ============
-- Stores GitHub OAuth access tokens for per-user repo access
-- CRITICAL: Tokens are encrypted at rest; never logged or sent to LLM
-- Separate table to enforce per-user access via RLS
CREATE TABLE IF NOT EXISTS github_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  github_id BIGINT NOT NULL, -- GitHub user ID from OAuth
  github_handle TEXT NOT NULL, -- GitHub username
  access_token TEXT NOT NULL, -- Encrypted by Supabase at rest
  token_type TEXT NOT NULL DEFAULT 'bearer',
  scope TEXT, -- OAuth scopes granted
  expires_at TIMESTAMP, -- If token expires
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS: Only the user can see/update their own token
ALTER TABLE github_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_oauth_tokens_select ON github_oauth_tokens FOR SELECT
  USING (user_id = auth.user_id());

CREATE POLICY github_oauth_tokens_insert ON github_oauth_tokens FOR INSERT
  WITH CHECK (user_id = auth.user_id());

CREATE POLICY github_oauth_tokens_update ON github_oauth_tokens FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

-- Index for fast lookup during backfill
CREATE INDEX IF NOT EXISTS idx_github_oauth_tokens_user_id
  ON github_oauth_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_github_oauth_tokens_github_handle
  ON github_oauth_tokens(github_handle);

-- ============ AUDIT LOGGING FOR OAUTH ============
-- Log OAuth token linking/unlinking for compliance
INSERT INTO audit_log (action, subject_type, details, created_at)
  VALUES ('migration_github_oauth', 'system', '{"version": "20260708030000"}', NOW())
  ON CONFLICT DO NOTHING;
