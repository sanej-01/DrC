# Retry Fallback & Failure Handling — Phase 4.3

Complete guide to resilience and error recovery in the scoring pipeline.

---

## Overview

**Problem:** Scoring can fail due to transient issues (API timeouts, rate limits, network errors).

**Solution:** Automatic retry with exponential backoff + manager alerts on permanent failure.

**Result:** Robust scoring that recovers from transient failures and escalates permanent ones.

---

## Retry Strategy

### Attempt Sequence

```
Attempt 1: Immediate
  ↓ (if fails)
  ↓ Wait 1 second
  ↓
Attempt 2: 1s later
  ↓ (if fails)
  ↓ Wait 2 seconds
  ↓
Attempt 3: 3s after Attempt 2
  ↓ (if fails)
  ↓ PERMANENT FAILURE
  ↓ Alert manager
```

### Configuration

```typescript
const DEFAULT_RETRY_CONFIG = {
  max_attempts: 3,
  backoff_ms: [1000, 2000, 4000], // 1s, 2s, 4s
  retry_on: [
    "TIMEOUT",
    "RATE_LIMIT",
    "API_ERROR",
    "NETWORK_ERROR",
    "TEMPORARY_FAILURE",
  ],
};
```

### Error Classification

Errors are classified to determine if they should trigger retry:

| Error Type | Retry? | Reason |
|------------|--------|--------|
| **TIMEOUT** | ✅ Yes | Transient network issue |
| **RATE_LIMIT** | ✅ Yes | Temporary API quota |
| **API_ERROR** | ✅ Yes | Transient service issue |
| **NETWORK_ERROR** | ✅ Yes | Connection problem |
| **SCHEMA_INVALID** | ❌ No | LLM output doesn't match schema (permanent) |
| **NOT_FOUND** | ❌ No | PR or workspace doesn't exist (permanent) |
| **AUTHENTICATION** | ❌ No | Invalid credentials (permanent) |

---

## Queue States

### State Diagram

```
pending
  ↓
triaging (Haiku evaluation)
  ↓
scoring (Sonnet evaluation)
  ├─ (on transient error)
  │  ↓
  │  pending (retry later)
  │  ↓
  │  [repeat if < 3 attempts]
  │
  └─ (on permanent error)
     ↓
     scoring_failed (give up, alert manager)

OR

completed (success)
```

### State Meanings

- **pending**: Waiting to be scored, or will retry after backoff
- **triaging**: Haiku triage in progress
- **scoring**: Sonnet scoring in progress
- **completed**: Successfully scored, results stored
- **scoring_failed**: Gave up after 3 attempts, needs manual review

---

## Failure Handling

### When Scoring Fails

1. **Classify Error**
   ```typescript
   const errorType = classifyError(error);
   // Returns: TIMEOUT, RATE_LIMIT, SCHEMA_INVALID, NOT_FOUND, etc.
   ```

2. **Decide Retry**
   ```typescript
   const shouldRetry = shouldRetryOnError(errorType);
   // Returns: true if transient, false if permanent
   ```

3. **Handle Failure**
   ```typescript
   const result = await handleScoringFailure({
     pr_id, pr_number, workspace_id,
     error_type, error_message,
     attempt, max_attempts
   });
   // Returns: { will_retry, alert_manager, next_retry_ms }
   ```

4. **Update Queue**
   - If retry: status = "pending", log to audit_log
   - If permanent: status = "scoring_failed", alert manager

### Manager Alert

When a PR fails permanently:

1. **Log Alert**
   ```
   audit_log entry:
   - action: "manager_alert_created"
   - pr_number: 123
   - error_type: "SCHEMA_INVALID"
   - message: "PR #123 scoring failed after 3 attempts"
   ```

2. **Send Notification**
   - Slack message (TODO: integration)
   - Email notification (TODO: integration)
   - In-app alert (TODO: UI)

3. **Manager Action**
   - Review PR and error
   - Manually retry if appropriate
   - Or mark as needs-investigation

---

## Backoff Strategy

### Exponential Backoff

Delays increase: 1s → 2s → 4s

**Rationale:**
- First retry: quick attempt (API might recover)
- Second retry: wait a bit longer (service might still be recovering)
- Third retry: longer wait (if still failing, probably permanent)

### Example Timeline

```
13:00:00 - Attempt 1 fails (RATE_LIMIT)
13:00:01 - Attempt 2 starts (after 1s backoff)
13:00:01 - Attempt 2 fails (still rate-limited)
13:00:03 - Attempt 3 starts (after 2s backoff)
13:00:03 - Attempt 3 fails (API still overloaded)
13:00:07 - Manager alerted, marked as scoring_failed
```

---

## Monitoring

### Queue Health

```sql
-- Check queue status distribution
SELECT status, COUNT(*) as count
FROM scoring_queue
WHERE workspace_id = 'uuid'
GROUP BY status;

-- Expected: mostly completed, few pending/scoring, rare failed
```

### Failure Rates

```sql
-- Permanent failures per workspace per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as failed_count,
  COUNT(*) * 100.0 / (
    SELECT COUNT(*) FROM audit_log
    WHERE action IN ('pr_scored', 'scoring_failed_exhausted')
    AND DATE(created_at) = DATE(audit_log.created_at)
  ) as failure_rate_pct
FROM audit_log
WHERE action = 'scoring_failed_exhausted'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Retry Effectiveness

```sql
-- How many PRs succeed after retry?
SELECT 
  COUNT(*) as total_retries,
  SUM(CASE WHEN final_status = 'completed' THEN 1 ELSE 0 END) as succeeded,
  SUM(CASE WHEN final_status = 'scoring_failed' THEN 1 ELSE 0 END) as failed
FROM (
  SELECT pr_id, MAX(status) as final_status
  FROM scoring_queue
  WHERE attempted_count > 1
  GROUP BY pr_id
) retried;
```

---

## Alert Examples

### TIMEOUT Error (Retriable)

```
PR #123 scoring timed out.
Attempt 1 of 3 failed: TIMEOUT connecting to Claude API
Retrying in 1 second...
```

### SCHEMA_INVALID Error (Permanent)

```
⚠️ MANAGER ALERT
PR #123 scoring failed after 3 attempts.
Error: SCHEMA_INVALID
Details: LLM response missing 'code_quality' field

This PR requires manual review or investigation.
```

### RATE_LIMIT Error (Retriable)

```
PR #456 scoring rate-limited.
Attempt 1 of 3 failed: RATE_LIMIT API quota exceeded
Retrying in 1 second...
```

---

## Recovery Options

### Automatic Retry

The queue processor automatically retries failed PRs using backoff.

### Manual Retry

Manager can manually retry a failed PR:

```sql
-- Mark as pending to retry
UPDATE scoring_queue
SET status = 'pending', attempted_count = 0
WHERE pr_id = 'uuid' AND status = 'scoring_failed';
```

### Investigation

For permanent failures, investigate:

1. Check audit_log for error type
2. Check if LLM output was malformed
3. Verify GitHub PR still exists
4. Check API credentials

---

## Integration Points

### Scoring Endpoint

When scoring fails, the endpoint:
1. Classifies error
2. Calls handleScoringFailure()
3. Updates queue status
4. Returns error response with retry info

### Queue Processor

A scheduled job processes pending PRs:
1. Query status = 'pending'
2. Call scoring endpoint
3. Update status based on result
4. On permanent failure: alert manager

---

## Configuration

### Max Attempts

```env
# In retry-logic.ts (currently hardcoded to 3)
# Can be made configurable:
SCORING_MAX_ATTEMPTS=3
```

### Backoff Times

```env
# In retry-logic.ts (currently hardcoded)
# Can be made configurable:
SCORING_BACKOFF_MS=1000,2000,4000
```

### Retry On Errors

```env
# In retry-logic.ts (currently hardcoded)
# Can be extended for new error types:
SCORING_RETRY_ON=TIMEOUT,RATE_LIMIT,API_ERROR,NETWORK_ERROR
```

---

## Next Steps

- Phase 4.4: Aggregates (compute 30/60/90-day rolling averages)
- Phase 4.5: Spend guardrail (daily cost cap enforcement)
- Phase 4.6: Audit logging (comprehensive audit trail)
- Integration: Queue processor job (poll and retry pending PRs)
- Integration: Manager alert channels (Slack, email, UI)
