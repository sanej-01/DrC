-- Dr. Codium MVP Baseline Migration
-- Idempotent: safe to re-run without errors

-- Enable extensions (idempotent with CREATE EXTENSION IF NOT EXISTS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types (idempotent with CREATE TYPE IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('developer', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM ('GOOD', 'IMPROVE', 'FIX', 'SUGGEST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pr_status AS ENUM ('pending', 'scored', 'scoring_failed', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Version marker table (to track baseline)
CREATE TABLE IF NOT EXISTS _dr_codium_meta (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert baseline marker (idempotent with ON CONFLICT)
INSERT INTO _dr_codium_meta (key, value)
  VALUES ('baseline_version', '0.2.0')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Enable Row Level Security globally (idempotent)
ALTER SYSTEM SET "row_security" = on;

-- Grant usage on public schema to anon role (idempotent)
GRANT USAGE ON SCHEMA public TO anon;
