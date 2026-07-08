# Aggregates & Low-Confidence Badges — Phase 4.4

Complete guide to rolling averages and developer performance aggregation.

---

## Overview

**Problem:** Raw scores vary widely per PR. Dashboard needs to show trend data (how is this developer doing over time?).

**Solution:** Compute rolling 30/60/90-day averages across all score dimensions. Track confidence level based on scoring volume.

**Result:** Stable, trend-aware performance insights for coaching and analytics.

---

## Aggregates Explained

### What Gets Aggregated

For each developer in each workspace, compute rolling averages:

| Dimension | What it Measures | Range |
|-----------|------------------|-------|
| **code_quality** | Code style, readability, maintainability | 0-100 |
| **bug_risk** | Likelihood of bugs or crashes | 0-100 (lower is better) |
| **architecture** | Design decisions, extensibility | 0-100 |
| **test_coverage** | Tests written, coverage quality | 0-100 |

### Time Windows

- **30-day**: Recent performance (last month)
- **60-day**: Medium-term trend (last 2 months)
- **90-day**: Long-term trend (last 3 months)

### Example

Developer "Alice" has 5 PRs scored in the past 30 days:

```
PR #101: code_quality=85, bug_risk=15, architecture=80, test_coverage=90
PR #102: code_quality=88, bug_risk=12, architecture=82, test_coverage=88
PR #103: code_quality=82, bug_risk=18, architecture=78, test_coverage=85
PR #104: code_quality=90, bug_risk=10, architecture=88, test_coverage=92
PR #105: code_quality=86, bug_risk=14, architecture=81, test_coverage=89

30-day aggregate:
  avg_code_quality = (85+88+82+90+86) / 5 = 86.2
  avg_bug_risk     = (15+12+18+10+14) / 5 = 13.8
  avg_architecture = (80+82+78+88+81) / 5 = 81.8
  avg_test_coverage= (90+88+85+92+89) / 5 = 88.8
  score_count      = 5
```

---

## Confidence Badges

### What is Confidence?

A confidence badge indicates **statistical reliability** of the aggregate.

- **LOW_CONFIDENCE**: Fewer than 3 scored PRs in the window
  - Result: High variance, not enough data
  - Display: Badge or disclaimer in UI
  - Coaching: "Not enough PRs to establish trend"

- **CONFIDENT**: 3 or more scored PRs in the window
  - Result: Stable signal, reasonably reliable
  - Display: Show average scores with confidence
  - Coaching: "Based on recent PRs, you should work on..."

### Why 3 PRs?

- **1 PR**: Single outlier can dominate (meaningless)
- **2 PRs**: Flipped scores look like trend, but could be noise
- **3+ PRs**: Statistical noise averaging out, pattern emerges

### Example

```
Developer "Bob":
  30-day: 2 PRs scored → confidence_badge_30d = "LOW_CONFIDENCE"
  60-day: 5 PRs scored → confidence_badge_60d = "CONFIDENT"
  90-day: 8 PRs scored → confidence_badge_90d = "CONFIDENT"

UI Display:
  30-day average: 82 (Low confidence — only 2 PRs)
  60-day average: 79 (Confident trend)
  90-day average: 76 (Confident trend — improving)
```

---

## Computation

### When Aggregates Update

1. **Incremental (Real-time)**
   - Triggered after each PR is scored
   - Updates only the affected developer's aggregates
   - Fast (milliseconds)
   - Called from: `/api/scoring/score-pr`

2. **Full Batch (Periodic)**
   - Triggered manually or on schedule
   - Recomputes all developers in workspace
   - Reconciles any drift
   - Endpoint: `POST /api/scoring/update-aggregates`

### Incremental Update Flow

```
1. Score PR (Haiku → Sonnet)
   ↓
2. Store scores in pr_scores table
   ↓
3. Call updateAggregatesForPR(workspace_id, pr_id)
   ↓
4. Fetch all 30/60/90-day scores for developer
   ↓
5. Compute rolling averages + confidence badge
   ↓
6. Upsert into pr_aggregates table
   ↓
7. Return to scoring endpoint (success)
```

### Full Batch Computation

```typescript
POST /api/scoring/update-aggregates
{
  "workspace_id": "uuid-123"
}

Response:
{
  "status": "completed",
  "workspace_id": "uuid-123",
  "developers_updated": 23,
  "aggregates_recomputed": 23,
  "duration_ms": 4521
}
```

---

## Data Storage

### pr_aggregates Table

```sql
-- Core aggregate scores
avg_code_quality_30d     DECIMAL(5,2)  -- e.g., 86.20
avg_bug_risk_30d         DECIMAL(5,2)
avg_architecture_30d     DECIMAL(5,2)
avg_test_coverage_30d    DECIMAL(5,2)
score_count_30d          INTEGER       -- 0 or more

-- Confidence badge
confidence_badge_30d     TEXT          -- 'LOW_CONFIDENCE' or 'CONFIDENT'

-- (Same fields for 60d and 90d windows)

-- Metadata
last_computed_at         TIMESTAMP     -- When aggregates were last recomputed
created_at               TIMESTAMP
updated_at               TIMESTAMP

-- Keys
UNIQUE(workspace_id, developer_id)
```

### Querying Aggregates

```sql
-- Get Alice's aggregates in workspace
SELECT *
FROM pr_aggregates
WHERE workspace_id = 'ws-123'
  AND developer_id = 'user-alice';

-- Get all developers in workspace with 30-day confidence
SELECT 
  developer_id,
  avg_code_quality_30d,
  avg_bug_risk_30d,
  avg_architecture_30d,
  avg_test_coverage_30d,
  score_count_30d,
  confidence_badge_30d
FROM pr_aggregates
WHERE workspace_id = 'ws-123'
ORDER BY avg_code_quality_30d DESC;

-- Find developers with LOW_CONFIDENCE in 30-day window
SELECT developer_id, score_count_30d
FROM pr_aggregates
WHERE workspace_id = 'ws-123'
  AND confidence_badge_30d = 'LOW_CONFIDENCE';
```

---

## API Reference

### Aggregate Computation

#### POST /api/scoring/update-aggregates

Trigger full recomputation of all aggregates for a workspace.

**Body:**
```json
{
  "workspace_id": "uuid-123"
}
```

**Response (200):**
```json
{
  "status": "completed",
  "workspace_id": "uuid-123",
  "developers_updated": 45,
  "aggregates_recomputed": 45,
  "duration_ms": 8234
}
```

**Response (500):**
```json
{
  "error": "Aggregate computation failed",
  "details": "Database connection timeout"
}
```

---

## Monitoring

### Computation Health

```sql
-- Check recent computation status
SELECT 
  computation_type,
  status,
  developers_updated,
  aggregates_recomputed,
  duration_ms,
  completed_at
FROM aggregate_computation_log
WHERE workspace_id = 'ws-123'
ORDER BY completed_at DESC
LIMIT 10;

-- Identify failed computations
SELECT 
  workspace_id,
  status,
  error_message,
  completed_at
FROM aggregate_computation_log
WHERE status = 'failed'
ORDER BY completed_at DESC;
```

### Aggregate Freshness

```sql
-- Find aggregates older than 24 hours
SELECT 
  developer_id,
  last_computed_at,
  NOW() - last_computed_at as age
FROM pr_aggregates
WHERE workspace_id = 'ws-123'
  AND last_computed_at < NOW() - INTERVAL '24 hours'
ORDER BY last_computed_at ASC;
```

### Confidence Distribution

```sql
-- How many developers have confident vs low-confidence aggregates?
SELECT 
  confidence_badge_30d,
  COUNT(*) as developer_count
FROM pr_aggregates
WHERE workspace_id = 'ws-123'
GROUP BY confidence_badge_30d;

-- Expected output:
--   CONFIDENT      | 28
--   LOW_CONFIDENCE |  5
```

### Scoring Volume per Developer

```sql
-- Identify developers with very few scores
SELECT 
  developer_id,
  score_count_30d,
  score_count_60d,
  score_count_90d
FROM pr_aggregates
WHERE workspace_id = 'ws-123'
ORDER BY score_count_30d ASC;
```

---

## Integration with Coaching

### Coach Card Creation (Phase 1.3)

When generating coaching cards, use aggregates to:

1. **Identify trends**: "Your test coverage dropped 5 points in 60 days"
2. **Offer guidance**: Only if confident (3+ PRs)
3. **Track progress**: Compare 30d vs 60d vs 90d
4. **Prioritize coaching**: Focus on dimensions where developer is weakest

### Example: Low Test Coverage

```
Scenario: Developer Bob has:
  avg_test_coverage_30d = 65 (CONFIDENT, 4 PRs)
  avg_test_coverage_60d = 70 (CONFIDENT, 8 PRs)
  Trend: Declining coverage

Coach Card:
  Dimension: test_coverage
  Title: "Your test coverage is dropping"
  Description: "60-day average: 70% → 30-day average: 65%"
  Severity: IMPROVE
  Recommendation: "Add unit tests to your PRs"
```

---

## Error Handling

### Partial Failures

If aggregate computation fails for one developer, others still compute:

```typescript
try {
  const agg = await computeDeveloperAggregates(supabase, ws_id, dev_id);
  await supabase.from("pr_aggregates").upsert(agg);
} catch (error) {
  console.error(`Failed for developer ${dev_id}:`, error);
  // Continue to next developer
}
```

### Missing Historical Data

If a developer has no PRs in a window:

```typescript
window_30d = {
  avg_code_quality: null,
  avg_bug_risk: null,
  // ... all nulls
  score_count: 0,
  confidence_badge: "LOW_CONFIDENCE"
}
```

---

## Performance Considerations

### Query Optimization

- **Indexed on** `(workspace_id, developer_id)` for fast lookups
- **Indexed on** `workspace_id` for bulk reads
- Single row upsert per developer (fast)

### Computational Cost

- **Incremental**: O(1) per PR scored (just 1 developer)
- **Batch**: O(D × W) where D=developers, W=window (typically < 1 second for 50 developers)

### Example: Full Batch Performance

```
Workspace with 45 developers:
- Fetch 30/60/90-day scores per developer: ~200ms
- Compute averages: ~50ms
- Upsert aggregates: ~150ms
- Total: ~400ms for full recomputation
```

---

## Next Steps

- Phase 4.5: Spend guardrail (daily cost cap enforcement)
- Phase 4.6: Audit logging (comprehensive audit trail)
- Integration: Coach card generation using aggregates
- Integration: Dashboard visualization of trends
- Configuration: Make confidence threshold configurable

---

## Configuration

### Confidence Threshold

Currently hardcoded to 3 PRs:

```typescript
const MIN_CONFIDENCE_THRESHOLD = 3;
```

To make configurable:

```env
CONFIDENCE_THRESHOLD_PRS=3
```

### Rolling Windows

Currently hardcoded to [30, 60, 90]:

```typescript
const windows = [30, 60, 90] as const;
```

Could extend to include 14-day or 180-day windows.
