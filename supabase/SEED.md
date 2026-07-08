# Seed Data — Demo Workspace & Team

Complete demo dataset to enable UI development and testing without live GitHub integration.

## What's Included

### Workspace
- **Platform Squad** — Demo engineering team

### Users (7)
**Developers:**
- Aisha Khan (high performer, improving 4 weeks)
- Marcus Lee (watch area — bug-risk regression)
- Dana Ortiz (improving, strong architecture)
- Sam Patel (steady performer)
- Wei Chen (growing, early stage)
- Liam Novak (early career, low confidence)

**Manager:**
- Priya Reddy (team lead)

### Repositories (3)
- api-service
- web-app
- database

### Pull Requests (8 merged PRs)
- 3 from Aisha (quality scores: 88–92)
- 2 from Marcus (watch area: 68–72, high bug-risk)
- 1 from Dana (improving: 82)
- 1 from Sam (steady: 78)
- 1 from Wei (growing: 80)
- 1 from Liam (early stage: 65)

### PR Scores (8 scored)
Four dimensions per PR:
- code_quality (0–100)
- bug_risk (0–100) — *lower is better*
- architecture (0–100)
- test_coverage (0–100)

**High performers:** Aisha (85–92 quality, 10–15 bug-risk)  
**Watch area:** Marcus (68–72 quality, 48–52 bug-risk)  
**Growing:** Wei, Liam, Dana  

### Feedback Items (7)
Typed feedback (GOOD/IMPROVE/FIX/SUGGEST) with file:line references:
- Aisha: mostly GOOD + IMPROVE suggestions
- Marcus: FIX items (null checks, SQL injection)
- Dana: GOOD + SUGGEST for optimization

### Coaching Cards
90-day rolling aggregates for each developer:
- Aisha: avg 88.3 quality, 12.3 bug-risk (3 PRs — high confidence)
- Marcus: avg 70 quality, 50 bug-risk (2 PRs — high confidence, watch)
- Others: 1 PR each (low confidence badge)

### Private Manager Notes
Priya's notes (never visible to developers):
- Aisha ready for architecture leadership
- Marcus needs security 1:1 (SQL injection concerns)
- Liam early in journey, pair with Dana

### Alerts
Action-framed (not surveillance):
- "Aisha ready to stretch" (architecture in top growth band)
- "Marcus may need a check-in" (supportive framing for regression)
- "Team coached 14 PRs today" (positive team milestone)

### Audit Log
Sample audit entries showing:
- PR scoring events (model_version, tokens_used, latency_ms)
- Note creation (private, manager-only)
- Alert generation (action-framed)

## Applying Seed Data

### Option A: Supabase Dashboard
1. Go to your Supabase project
2. SQL Editor
3. Create new query
4. Paste contents of `supabase/seed.sql`
5. Run

### Option B: Via Script
```bash
# After migrations are applied:
npx tsx scripts/seed-database.ts
```

### Option C: In Development
Seed is automatically applied on `npm run dev` (if configured in `.env.local`).

## Data Characteristics

### For UI Testing
- **Developer dashboard:** Aisha has complete profile (3 PRs, 90d coaching card, alerts)
- **Manager dashboard:** Priya sees all 6 developers, team garden, alert tray
- **Coaching cards:** Mix of high-confidence (3+ PRs) and low-confidence (1 PR)
- **Private notes:** Test that Aisha can't see Priya's note about her

### For Design Validation
- High variety in score distributions (65–92 range)
- Mix of growth trajectories (improving, steady, watch, early-stage)
- Real-world feedback types and file references
- Alerts in various stages (not dismissed, not snoozed)

### For Testing
- Team garden: 6 developers at different growth stages
- Dispute model: ready (no disputes in seed, but schema exists)
- Audit trail: scoring events with token/latency data
- RLS: verify developers only see own data, manager sees all

## IDs Reference

All UUIDs use predictable pattern (last 4 digits increment) for debugging:

```
Workspace:  550e8400-e29b-41d4-a716-446655440000
Users:      550e8400-e29b-41d4-a716-446655440001–006 (devs)
            550e8400-e29b-41d4-a716-446655440099 (manager)
Repos:      550e8400-e29b-41d4-a716-446655440010–012
PRs:        550e8400-e29b-41d4-a716-446655440100–108
Scores:     550e8400-e29b-41d4-a716-446655440200–208
Feedback:   550e8400-e29b-41d4-a716-446655440300–305
```

## Resetting Seed

To clear and re-seed:

```sql
-- Delete in dependency order
DELETE FROM feedback_helpfulness WHERE feedback_id IN (
  SELECT id FROM feedback_items
);
DELETE FROM feedback_items;
DELETE FROM disputes;
DELETE FROM pr_scores;
DELETE FROM pull_requests;
DELETE FROM alerts;
DELETE FROM notes;
DELETE FROM coaching_cards;
DELETE FROM audit_log;
DELETE FROM memberships;
DELETE FROM repos;
DELETE FROM users;
DELETE FROM workspaces;

-- Then re-run seed.sql
```

## Next Steps

Phase 2: Auth integration  
- Link seed users to Supabase auth
- Test login flows
- Verify RLS with authenticated users

Phase 5+: UI development  
- Render developer dashboard against Aisha's data
- Render manager dashboard against Priya's view
- Test coaching card variants
- Test alert interactions
