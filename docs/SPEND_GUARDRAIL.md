# Spend Guardrail & Cost Enforcement — Phase 4.5

Complete guide to cost management and budget controls for AI scoring.

---

## Overview

**Problem:** Scoring via LLM APIs incurs costs. Without guardrails, a misconfiguration or integration issue could lead to runaway costs.

**Solution:** Daily cost cap per workspace + global kill-switch + detailed cost tracking + manager alerts.

**Result:** Predictable, bounded costs with full transparency.

---

## Cost Model

### Per-PR Costs

| Stage | Model | Tokens (Avg) | Cost |
|-------|-------|--------------|------|
| **Triage** | Haiku | 500 in, 50 out | ~$0.00001 (0.001¢) |
| **Scoring** | Sonnet | 2000 in, 300 out | ~$0.0003 (0.03¢) |
| **Total per PR** | Both | — | ~$0.00031 (0.031¢) |

### Example Daily Costs

```
Workspace with daily cap = $500

1 PR scored:  $0.0003 (trivial)
100 PRs:      $0.03
1000 PRs:     $0.30
10,000 PRs:   $3.00
```

At default $500/day cap, you'd need ~**1.6 million PRs** to hit the limit (unlikely!).

---

## Daily Cost Cap

### What it Does

- **Tracks** total cost per workspace per calendar day
- **Enforces** a maximum daily spend (configurable per workspace)
- **Pauses** scoring when cap is reached (if `pause_on_cap=true`)
- **Logs** all costs for audit trail and billing

### Configuration

#### Per-Workspace Config

```sql
-- Set daily cap to $100 (10000 cents)
UPDATE workspace_cost_config
SET daily_cap_cents = 10000
WHERE workspace_id = 'ws-123';

-- Disable scoring for this workspace (emergency)
UPDATE workspace_cost_config
SET enable_scoring = FALSE
WHERE workspace_id = 'ws-123';

-- Don't pause on cap, just alert
UPDATE workspace_cost_config
SET pause_on_cap = FALSE
WHERE workspace_id = 'ws-123';
```

#### Global Kill-Switch

In `.env`:

```
# Set to "true" to disable all scoring globally (emergency)
SCORING_KILL_SWITCH=false
```

When `SCORING_KILL_SWITCH=true`, all scoring endpoints return 429 with error message.

---

## Cost Tracking

### Cost Ledger Table

```sql
cost_ledger:
- workspace_id
- pr_id
- action (triage | score | refetch | error_retry)
- model (haiku, sonnet, etc.)
- tokens_input, tokens_output
- estimated_cost_cents
- tracking_date (YYYY-MM-DD)
```

Every scoring action logged for audit trail.

### Daily Cost Tracking

```sql
daily_cost_tracking:
- workspace_id
- tracking_date (YYYY-MM-DD)
- total_cost_cents (sum of all costs for day)
- prs_scored (count)
- is_capped (TRUE if daily cap reached)
- capped_at (timestamp when cap triggered)
```

Upserted after each scoring action to keep totals current.

---

## Enforcement Flow

### Before Scoring

```
1. Fetch workspace cost config (daily_cap_cents, enable_scoring, pause_on_cap)
2. Check global kill-switch
   ├─ If TRUE → reject with 429
   └─ If FALSE → continue
3. Check workspace enable_scoring flag
   ├─ If FALSE → reject with 429
   └─ If TRUE → continue
4. Get today's total_cost_cents
5. Check if already capped
   ├─ If is_capped=TRUE and pause_on_cap=TRUE → reject with 429
   └─ If FALSE → continue
6. Project cost: current + estimated_for_this_pr
7. Check projection vs cap
   ├─ If projected > cap and pause_on_cap=TRUE → mark capped, reject with 429
   └─ If within cap → allow scoring
```

### Error Response

```json
{
  "error": "Daily cost cap reached",
  "reason": "Would exceed daily cost cap ($500.00)",
  "cost_status": {
    "workspace_id": "ws-123",
    "tracking_date": "2026-07-08",
    "total_cost_cents": 49500,
    "daily_cap_cents": 50000,
    "pct_of_cap": 99.0,
    "is_capped": true,
    "prs_scored": 150000
  }
}
```

Status code: **429 Too Many Requests** (indicates rate/cost limit, not 400 error)

---

## API Reference

### GET /api/scoring/cost-status?workspaceId=UUID

Get current daily cost status.

**Response (200):**

```json
{
  "status": "ok",
  "cost_status": {
    "workspace_id": "ws-123",
    "tracking_date": "2026-07-08",
    "total_cost_cents": 12500,
    "daily_cap_cents": 50000,
    "pct_of_cap": 25.0,
    "is_capped": false,
    "prs_scored": 41667
  },
  "cost_breakdown": {
    "total_cost_cents": 12500,
    "by_model": {
      "haiku": 41,
      "sonnet": 12459
    },
    "by_action": {
      "triage": 41,
      "score": 12459
    },
    "prs_counted": 41667
  }
}
```

### POST /api/scoring/cost-status

Admin actions: reset cap or update config.

**Body (Reset Cap):**

```json
{
  "action": "reset_cap",
  "workspaceId": "ws-123",
  "date": "2026-07-08"
}
```

**Response (200):**

```json
{
  "status": "cap_reset",
  "cost_status": {
    "total_cost_cents": 0,
    "is_capped": false
  }
}
```

**Body (Update Config):**

```json
{
  "action": "update_config",
  "workspaceId": "ws-123",
  "config": {
    "daily_cap_cents": 10000,
    "enable_scoring": true,
    "pause_on_cap": true,
    "alert_at_pct_of_cap": 75
  }
}
```

**Response (200):**

```json
{
  "status": "config_updated",
  "config": {
    "daily_cap_cents": 10000,
    "enable_scoring": true,
    "pause_on_cap": true,
    "alert_at_pct_of_cap": 75
  }
}
```

---

## Monitoring & Alerts

### Query: Today's Cost Status

```sql
SELECT 
  workspace_id,
  tracking_date,
  total_cost_cents,
  daily_cap_cents,
  ROUND((total_cost_cents * 100.0) / daily_cap_cents, 1) as pct_of_cap,
  is_capped,
  prs_scored
FROM daily_cost_tracking
WHERE tracking_date = CURRENT_DATE
ORDER BY pct_of_cap DESC;
```

### Query: Approaching Cap (75%+)

```sql
SELECT 
  workspace_id,
  tracking_date,
  total_cost_cents,
  daily_cap_cents,
  ROUND((total_cost_cents * 100.0) / daily_cap_cents, 1) as pct_of_cap
FROM daily_cost_tracking
WHERE tracking_date = CURRENT_DATE
  AND (total_cost_cents * 100.0) / daily_cap_cents >= 75
ORDER BY pct_of_cap DESC;
```

### Query: Capped Workspaces

```sql
SELECT 
  workspace_id,
  tracking_date,
  capped_at,
  total_cost_cents,
  daily_cap_cents
FROM daily_cost_tracking
WHERE is_capped = TRUE
  AND tracking_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY capped_at DESC;
```

### Query: Cost by Model

```sql
SELECT 
  DATE(created_at) as date,
  model,
  action,
  COUNT(*) as call_count,
  ROUND(SUM(estimated_cost_cents)::numeric, 2) as total_cost_cents
FROM cost_ledger
WHERE workspace_id = 'ws-123'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), model, action
ORDER BY date DESC, total_cost_cents DESC;
```

### Query: Historical Daily Costs

```sql
SELECT 
  tracking_date,
  COUNT(*) as workspaces_active,
  SUM(total_cost_cents) as total_cost_cents,
  AVG(total_cost_cents) as avg_cost_per_workspace,
  MAX(total_cost_cents) as max_cost_per_workspace
FROM daily_cost_tracking
WHERE tracking_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tracking_date
ORDER BY tracking_date DESC;
```

---

## Scenarios & Responses

### Scenario 1: Normal Operation

```
Workspace cap: $500/day
Current cost: $125 (25%)
Incoming PR: estimated $0.00031

Flow:
  ✓ Kill-switch: OFF
  ✓ enable_scoring: TRUE
  ✓ Not capped yet
  ✓ Projected cost ($125.00031) < cap ($500) 
  ✓ SCORE IT
  → Log cost
  → Total now: $125.00031
```

### Scenario 2: Cap Reached

```
Workspace cap: $500/day
Current cost: $499.50 (99.9%)
Incoming PR: estimated $0.00031

Flow:
  ✓ Kill-switch: OFF
  ✓ enable_scoring: TRUE
  ✗ Projected cost ($499.50031) > cap ($500)
  ✗ PAUSE
  → Mark as_capped = TRUE
  → Alert manager
  → Return 429
```

### Scenario 3: Global Emergency

```
SCORING_KILL_SWITCH=true

Any scoring request:
  ✗ Kill-switch: ON
  ✗ REJECT with "Global scoring disabled"
  → Return 429
```

### Scenario 4: Workspace Disabled

```
workspace_cost_config.enable_scoring = FALSE

Any scoring request:
  ✓ Kill-switch: OFF
  ✗ enable_scoring: FALSE
  ✗ REJECT with "Scoring disabled for this workspace"
  → Return 429
```

---

## Recovery Options

### Option 1: Reset Daily Cap

```bash
curl -X POST http://localhost:3000/api/scoring/cost-status \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reset_cap",
    "workspaceId": "ws-123",
    "date": "2026-07-08"
  }'
```

Clears `is_capped` flag for the day, allows scoring to resume.

### Option 2: Increase Daily Cap

```bash
curl -X POST http://localhost:3000/api/scoring/cost-status \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update_config",
    "workspaceId": "ws-123",
    "config": {
      "daily_cap_cents": 100000
    }
  }'
```

Increases cap to $1000/day, allows more PRs to score.

### Option 3: Disable Cap Enforcement

```bash
curl -X POST http://localhost:3000/api/scoring/cost-status \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update_config",
    "workspaceId": "ws-123",
    "config": {
      "pause_on_cap": false
    }
  }'
```

Scoring continues even if cap exceeded (just logs cost, doesn't block).

### Option 4: Global Disable (Emergency)

```bash
# In .env
SCORING_KILL_SWITCH=true
```

Completely disables scoring globally. Requires restart.

---

## Billing & Reconciliation

### Daily Reconciliation

```sql
-- Verify cost_ledger totals match daily_cost_tracking
SELECT 
  dct.workspace_id,
  dct.tracking_date,
  dct.total_cost_cents as tracked_total,
  ROUND(SUM(cl.estimated_cost_cents)::numeric, 2) as ledger_sum,
  ABS(dct.total_cost_cents - SUM(cl.estimated_cost_cents)) as diff
FROM daily_cost_tracking dct
LEFT JOIN cost_ledger cl 
  ON dct.workspace_id = cl.workspace_id 
  AND dct.tracking_date = cl.tracking_date
GROUP BY dct.workspace_id, dct.tracking_date
HAVING ABS(dct.total_cost_cents - SUM(cl.estimated_cost_cents)) > 1; -- >1 cent diff
```

### Monthly Invoice

```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  workspace_id,
  ROUND(SUM(estimated_cost_cents)::numeric / 100, 2) as total_cost_usd,
  COUNT(DISTINCT pr_id) as prs_scored
FROM cost_ledger
WHERE action = 'score' -- Full scores only, not retries
GROUP BY DATE_TRUNC('month', created_at), workspace_id
ORDER BY month DESC, total_cost_usd DESC;
```

---

## Configuration Examples

### Dev/Testing Workspace

```sql
-- Low cap for testing
UPDATE workspace_cost_config
SET daily_cap_cents = 1000 -- $10/day
WHERE workspace_id = 'dev-ws-1';
```

### Production Workspace (Standard)

```sql
-- Standard enterprise tier
UPDATE workspace_cost_config
SET daily_cap_cents = 50000 -- $500/day
WHERE workspace_id = 'prod-ws-acme';
```

### Production Workspace (High-Volume)

```sql
-- High-volume scoring (e.g., 10k+ PRs/day)
UPDATE workspace_cost_config
SET daily_cap_cents = 500000 -- $5000/day
WHERE workspace_id = 'prod-ws-bigcorp';
```

---

## Next Steps

- Phase 4.6: Audit logging (comprehensive audit trail for compliance)
- Integration: Manager alerts when cost approaching cap
- Integration: Dashboard cost visualization
- Configuration: Make cost defaults configurable per environment

---

## Environment Variables

```env
# Global kill-switch (emergency scoring disable)
SCORING_KILL_SWITCH=false

# Default daily cap (can be overridden per workspace)
# Currently hardcoded in code, could be made configurable:
# WORKSPACE_DEFAULT_DAILY_CAP_CENTS=50000
```
