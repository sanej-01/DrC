# Dr. Codium Database Schema

Complete schema for Phase 1 MVP. All tables are designed with:

✅ **Anti-surveillance framing** — Manager notes private, no raw diffs stored  
✅ **Privacy by default** — Row-level security on every table  
✅ **Idempotent migrations** — Safe to re-run  
✅ **Immutable audit trail** — Complete action log  

## Core Tables

### Workspaces & Users
- **workspaces** — Organizations using Dr. Codium
- **users** — Developers and managers (linked to Supabase auth)
- **memberships** — User roles in workspaces (developer/manager/admin)

### GitHub Integration
- **repos** — GitHub repositories linked to workspaces
- **pull_requests** — Merged PRs (metadata only, no diffs)

### Scoring & Feedback
- **pr_scores** — Four quality dimensions (0–100): code_quality, bug_risk, architecture, test_coverage
- **feedback_items** — Typed feedback (GOOD/IMPROVE/FIX/SUGGEST) with file:line refs
- **feedback_helpfulness** — Idempotent thumbs up/down per feedback item

### Coaching & Insights
- **coaching_cards** — Aggregated scores per developer per time window (30/60/90d)
- **notes** — Private manager-only notes (never visible to developers)
- **alerts** — Action-framed alerts (e.g., "ready to stretch", score regressions)

### Disputes & Governance
- **disputes** — Developer disputes a score; manager accepts/rejects
- **audit_log** — Complete audit trail (action, actor, model_version, tokens, latency)

## Critical Constraints

### No Raw Diffs Stored (TC-SCR-010)
✅ `pull_requests` table contains **only metadata**: additions_count, deletions_count, files_changed_count  
✅ No columns named `diff`, `patch`, `code`, `body`, or similar  
✅ Scoring happens **in-memory only**; diffs never persisted  
✅ Test `TC-SCR-010` verifies this constraint every test run  

### Row-Level Security (RLS)
All tables have RLS enabled via Phase 1.2 policies:
- Developers see only their own data
- Managers see their team's data
- Cross-tenant access denied by policy

### Audit Trail (TC-SCR-007)
Every scoring action recorded:
- `model_version` — Which Claude model did the scoring
- `tokens_used` — Input + output tokens for cost tracking
- `latency_ms` — Scoring latency for SLA monitoring

## Migrations

All migrations are in `supabase/migrations/` and are idempotent:

- `20260708000000_baseline.sql` — Extensions, enums, RLS setup
- `20260708010000_schema_core.sql` — All Phase 1.1 tables

Apply via:
```bash
# Option A: Supabase dashboard SQL Editor
# Paste migration content and run

# Option B: Check if applied
npx tsx scripts/check-migrations.ts
```

## Indexes

Performance indexes on common query paths:
- `memberships(workspace_id, user_id)`
- `pull_requests(workspace_id, repo_id, author_user_id, merged_at)`
- `coaching_cards(workspace_id, user_id, window_start, window_days)`
- `alerts(workspace_id, for_user_id)`
- `audit_log(workspace_id, action)`

## Next

Phase 1.2: Row-level security policies on all tables.
