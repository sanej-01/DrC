-- Dr. Codium MVP Phase 2.5 — Invite Tokens
-- Secure invite links for developers to join workspaces
-- Idempotent: uses IF NOT EXISTS

-- ============ INVITE TOKENS ============
-- One-time use invite links for developers
CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id), -- Manager who created invite
  token TEXT UNIQUE NOT NULL, -- Random token (32+ bytes, base64)
  email_pattern TEXT, -- Optional: restrict to email domain (e.g., @company.com)
  max_uses INTEGER DEFAULT 1, -- Max number of times invite can be used
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP NOT NULL, -- Invite expires after X days
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_invite_tokens_workspace
  ON invite_tokens(workspace_id)
  WHERE used_count < max_uses AND expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token
  ON invite_tokens(token);

-- No RLS on invite_tokens — tokens are the access control mechanism

-- ============ AUDIT LOGGING FOR INVITES ============
-- Log invite creation and usage
INSERT INTO audit_log (action, subject_type, details, created_at)
  VALUES ('migration_invite_tokens', 'system', '{"version": "20260708050000"}', NOW())
  ON CONFLICT DO NOTHING;
