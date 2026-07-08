# PR Scoring Pipeline — Phase 4.1-4.2

Complete guide to LLM-based PR scoring with cost optimization.

---

## Overview

**Goal:** Score merged PRs across four quality dimensions using Claude.

**Strategy:** Cost-optimized two-step process:
1. **Haiku Triage (Fast, Cheap):** Quick assessment if PR should be fully scored
2. **Sonnet Scoring (Capable, Detailed):** Comprehensive 4-dimension scoring with feedback

**Result:** Structured scores + feedback items + audit trail

---

## Scoring Dimensions

Each dimension scored 0-100:

### 1. Code Quality
Readability, maintainability, best practices.
- **80+**: Well-written, maintainable code
- **60-79**: Decent quality, some improvements
- **40-59**: Notable issues, refactoring recommended
- **0-39**: Significant concerns

### 2. Bug Risk
Lower score = higher risk. Edge cases, error handling, type safety.
- **80+**: Very low risk, robust code
- **60-79**: Acceptable risk, minor edge cases
- **40-59**: Notable risks, potential bugs
- **0-39**: High risk, likely bugs

### 3. Architecture
Design patterns, separation of concerns, scalability.
- **80+**: Well-architected, scalable
- **60-79**: Solid design, minor improvements
- **40-59**: Some architectural concerns
- **0-39**: Poor architecture, refactoring needed

### 4. Test Coverage
Unit tests, integration tests, test quality.
- **80+**: Comprehensive testing
- **60-79**: Good coverage, some gaps
- **40-59**: Partial coverage, needs improvement
- **0-39**: Minimal or no testing

---

## Scoring Process

### Step 1: Queue PR for Scoring

When PR is enqueued (Phase 3):
```sql
INSERT INTO scoring_queue (workspace_id, pr_id, status)
VALUES ('...', '...', 'pending');
```

### Step 2: Haiku Triage

Quick assessment (expensive to score every PR):
- Input: PR metadata (files, additions, deletions)
- Output: `should_score: boolean`
- Cost: ~$0.00001 (very cheap)
- Time: ~200ms

### Step 3: Sonnet Scoring (if `should_score`)

Full assessment if triage says yes:
- Input: PR diff (fetched fresh, never stored)
- Output: 4 scores + feedback items
- Cost: ~$0.0003 per PR (100x triage)
- Time: ~2-5 seconds

### Step 4: Store Results

Store in three tables:
- `pr_scores`: The four dimension scores
- `scoring_feedback`: Individual feedback items
- `scoring_audit`: Cost, tokens, latency, model version

---

## Feedback Types

Each feedback item has a type:

| Type | Purpose | Severity |
|------|---------|----------|
| **GOOD** | Highlight excellent code/patterns | None |
| **IMPROVE** | Suggest enhancements | Low |
| **FIX** | Flag bugs/errors/issues | Medium/High |
| **SUGGEST** | Propose alternative approaches | Low |

Example:
```json
{
  "type": "FIX",
  "dimension": "bug_risk",
  "title": "Null check missing",
  "description": "user.profile could be null but is accessed directly on line 42",
  "severity": "high",
  "file_path": "src/lib/user.ts",
  "line_number": 42
}
```

---

## Cost Optimization

### Model Routing

```
Haiku Triage
  ↓
  if should_score:
    ↓
    Sonnet Scoring
  else:
    ↓
    (skip, use default scores)
```

### Cost Breakdown

**Haiku Triage:**
- Input: ~200 tokens
- Output: ~50 tokens
- Cost: ~$0.00001 (0.001 cents)

**Sonnet Scoring:**
- Input: ~2,000 tokens (includes diff)
- Output: ~500 tokens (scores + feedback)
- Cost: ~$0.0003 (0.03 cents)

**Per PR:**
- If skipped: $0.00001
- If scored: $0.00031
- **10x savings by skipping trivial PRs**

### Daily Cost Cap

Set `WORKSPACE_DAILY_COST_CAP_CENTS` env var:
```env
# Limits scoring to X cents per workspace per day
WORKSPACE_DAILY_COST_CAP_CENTS=50000  # $500/day
```

When limit reached:
- Stop scoring for the day
- Return default scores for remaining PRs
- Alert workspace manager
- Resume next day

---

## API Endpoint

**POST /api/scoring/score-pr**

Request:
```json
{ "pr_id": "uuid" }
```

Response:
```json
{
  "status": "scored",
  "pr_id": "uuid",
  "scores": {
    "code_quality": 82,
    "bug_risk": 75,
    "architecture": 78,
    "test_coverage": 70
  },
  "audit": {
    "triage_model": "claude-3-haiku-20240307",
    "scoring_model": "claude-3-sonnet-20240229",
    "total_latency_ms": 3500,
    "estimated_cost_cents": 3
  }
}
```

---

## Auditing

All scoring runs logged to `scoring_audit` table:

```sql
SELECT 
  pr_id,
  triage_model,
  scoring_model,
  triage_tokens_input + triage_tokens_output as triage_tokens,
  scoring_tokens_input + scoring_tokens_output as scoring_tokens,
  total_latency_ms,
  estimated_cost_cents
FROM scoring_audit
WHERE workspace_id = 'uuid'
ORDER BY created_at DESC;
```

**Audit includes:**
- Model versions used (track performance)
- Token counts (cost tracking)
- Latency (performance monitoring)
- Result hash (idempotency verification)

---

## Retry & Failure Handling

**Scoring Queue States:**
- `pending`: Waiting to be scored
- `triaging`: Haiku triage in progress
- `scoring`: Sonnet scoring in progress
- `completed`: Successfully scored
- `failed`: Failed after max attempts

**Retry Logic:**
- Max 3 attempts per PR
- On failure: Mark as pending, increment counter
- After 3 failures: Mark as failed, alert manager
- Manager can manually retry if needed

**Error Types:**
- API timeout: Retry
- Schema validation failed: Retry (might be intermittent)
- Invalid diff: Mark as failed (data issue)

---

## Monitoring

### Token Usage

```sql
SELECT 
  SUM(triage_tokens_input + triage_tokens_output) as triage_tokens,
  SUM(scoring_tokens_input + scoring_tokens_output) as scoring_tokens,
  COUNT(*) as pr_count
FROM scoring_audit
WHERE created_at > NOW() - INTERVAL '1 day'
AND workspace_id = 'uuid';
```

### Cost Tracking

```sql
SELECT 
  DATE(created_at) as date,
  SUM(estimated_cost_cents) as total_cost_cents,
  COUNT(*) as pr_count,
  AVG(estimated_cost_cents) as avg_cost_per_pr
FROM scoring_audit
WHERE workspace_id = 'uuid'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Performance

```sql
SELECT 
  AVG(triage_latency_ms) as avg_triage_ms,
  AVG(scoring_latency_ms) as avg_scoring_ms,
  AVG(total_latency_ms) as avg_total_ms,
  MAX(total_latency_ms) as max_latency_ms
FROM scoring_audit
WHERE workspace_id = 'uuid'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## Configuration

### Enable/Disable Scoring

```env
# Kill switch (stop all scoring)
SCORING_KILL_SWITCH=false  # Set to true to disable
```

### Cost Cap

```env
# Per-workspace daily cost cap (in cents)
WORKSPACE_DAILY_COST_CAP_CENTS=50000  # $500/day
```

### Model Selection

Edit `lib/score-router.ts` to change models:
```typescript
// Triage model (must be cheaper than scoring model)
model: "claude-3-haiku-20240307",

// Scoring model (must be capable)
model: "claude-3-sonnet-20240229",
```

---

## Next Steps

- Phase 4.3: Retry fallback (max 3 attempts, failure alerts)
- Phase 4.4: Aggregates (compute 30/60/90-day rolling averages)
- Phase 4.5: Spend guardrail (daily cost cap enforcement)
- Phase 4.6: Audit logging (complete audit trail)
- Phase 5: Developer dashboard (display scores + feedback)
