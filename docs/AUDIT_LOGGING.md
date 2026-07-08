# Audit Logging & Compliance — Phase 4.6

Complete guide to comprehensive audit trail for compliance (SOC2, GDPR, PCI DSS).

---

## Overview

**Problem:** Compliance requires detailed, immutable audit trails of all critical actions. Without structured logging, you can't demonstrate control effectiveness or respond to incidents.

**Solution:** Comprehensive, immutable audit log with structured data, retention policies, and compliance reporting.

**Result:** Auditable, defensible operations with full forensic capability.

---

## Audit Actions Tracked

### Scoring Pipeline

| Action | Severity | When | Details |
|--------|----------|------|---------|
| `pr_queued` | INFO | PR added to scoring queue | pr_id, pr_number |
| `pr_triage_started` | INFO | Haiku triage begins | pr_id, model |
| `pr_triage_completed` | INFO | Haiku triage finishes | pr_id, took_ms |
| `pr_scoring_started` | INFO | Sonnet scoring begins | pr_id, model |
| `pr_scored` | INFO | PR successfully scored | pr_id, scores, cost, latency |
| `scoring_retry` | WARNING | Retry after transient failure | pr_id, attempt, error_type |
| `scoring_failed_exhausted` | ERROR | Failed after max retries | pr_id, attempts, error_type |
| `scoring_failed_permanent` | ERROR | Permanent error, no retry | pr_id, error_type |

### Cost Management

| Action | Severity | When | Details |
|--------|----------|------|---------|
| `cost_logged` | INFO | Cost recorded for PR | pr_id, cost_cents, model |
| `cost_cap_reached` | CRITICAL | Daily cap exceeded | daily_cost, cap_cents |
| `cost_cap_reset` | NOTICE | Admin reset cap | workspace_id, date |

### Security & Risk

| Action | Severity | When | Details |
|--------|----------|------|---------|
| `secret_detected` | CRITICAL/HIGH/MEDIUM | Secret found in diff | secret_type, file_path, severity |
| `secret_redacted` | INFO | Secret redacted before scoring | secret_type, count |
| `large_pr_detected` | NOTICE | PR >500 files or >10k lines | pr_id, file_count, lines |
| `scoring_skipped_empty` | INFO | Empty diff → skip scoring | pr_id |
| `scoring_skipped_draft` | INFO | Draft PR → skip scoring | pr_id |

### Oversight

| Action | Severity | When | Details |
|--------|----------|------|---------|
| `manager_alert_created` | NOTICE | Manager notified | pr_id, alert_type, message |
| `dispute_created` | NOTICE | Developer disputed score | pr_id, dispute_reason |
| `dispute_resolved` | NOTICE | Manager resolved dispute | pr_id, resolution |

### Administration

| Action | Severity | When | Details |
|--------|----------|------|---------|
| `admin_action` | NOTICE | Admin manual action | action_type, details |
| `config_updated` | NOTICE | Config changed | config_field, old_value, new_value |
| `workspace_created` | NOTICE | New workspace | workspace_id, creator_id |

---

## Data Structure

### Audit Entry

```typescript
{
  id: UUID,                              // Immutable ID
  workspace_id: UUID,                    // Workspace context
  user_id: UUID (nullable),              // Who did it
  action: audit_action,                  // Type of action
  severity: INFO|NOTICE|WARNING|ERROR|CRITICAL,
  source: api|webhook|poller|backfill|invite_accept|admin_panel|system|cron,
  
  subject_type: "pr"|"workspace"|"user"|"config"|"alert"|"dispute",
  subject_id: UUID (nullable),           // What it's about
  
  details: JSONB,                        // Action-specific data
  
  ip_address: INET (nullable),           // For API calls
  user_agent: TEXT (nullable),           // Browser/client info
  request_id: TEXT (nullable),           // Trace linking
  
  created_at: TIMESTAMP (immutable),     // When (UTC)
  deleted_at: TIMESTAMP (nullable),      // Soft-delete only
  deleted_by: UUID (nullable),           // Who deleted it
  deletion_reason: TEXT (nullable)       // Why deleted
}
```

### RLS (Row-Level Security)

- **Developers:** Cannot see audit log (no access)
- **Managers:** Can see audit log for their workspace (view only)
- **Admins:** Full access to audit log (view + soft-delete)

---

## Audit Severity Levels

| Level | When Used | Example |
|-------|-----------|---------|
| **INFO** | Normal operations | PR scored, cost logged |
| **NOTICE** | Notable but normal | Manager alert sent, config updated |
| **WARNING** | Potential issue | Retry attempt, cost approaching cap |
| **ERROR** | Error occurred | Scoring failed, permanent error |
| **CRITICAL** | Severe issue | Cost cap reached, secret detected |

---

## Compliance Requirements

### SOC2 Type II

**Control:** CC7.2 - System Monitoring

- ✅ All critical actions logged with timestamps
- ✅ Who (user_id), what (action), when (created_at), where (source)
- ✅ Immutable audit trail (cannot delete audit entries)
- ✅ Retention: 7 years default

### GDPR

**Article 32 - Security of Processing**

- ✅ Detailed records of all data processing activities
- ✅ Audit log shows intent and outcome of scoring
- ✅ User can request audit history of their PRs

**Article 17 - Right to be Forgotten**

- ⚠️ Audit entries are NOT deleted (immutable for compliance)
- ✅ User data is deleted, but audit shows deletion occurred
- ⚠️ Audit log is an exception to right to deletion (legal obligation)

### PCI DSS

**Requirement 10 - Logging & Monitoring**

- ✅ All system access logged (who, what, when)
- ✅ Failed access attempts logged with severity ERROR
- ✅ Admin actions logged separately
- ✅ Log retention 1+ years

---

## Querying Audit Log

### API: Query Audit Entries

**GET /api/audit/query**

```bash
curl -X GET "http://localhost:3000/api/audit/query?workspaceId=ws-123&action=pr_scored&limit=50"
```

**Query Parameters:**
- `workspaceId` (required): Workspace UUID
- `action`: Filter by action type
- `severity`: Filter by severity (INFO, WARNING, ERROR, CRITICAL)
- `subjectType`: Filter by subject (pr, workspace, config, etc.)
- `startDate`: From date (YYYY-MM-DD)
- `endDate`: To date (YYYY-MM-DD)
- `limit`: Max results (default 100, max 1000)

**Response:**

```json
{
  "status": "ok",
  "count": 42,
  "logs": [
    {
      "id": "audit-uuid",
      "workspace_id": "ws-123",
      "user_id": "user-alice",
      "action": "pr_scored",
      "severity": "INFO",
      "source": "api",
      "subject_type": "pr",
      "subject_id": "pr-uuid",
      "details": {
        "pr_number": 456,
        "scores": {
          "code_quality": 85,
          "bug_risk": 15,
          "architecture": 82,
          "test_coverage": 90
        },
        "scoring_model": "claude-3-5-sonnet-20241022",
        "total_tokens": 2500,
        "cost_cents": 0.03,
        "latency_ms": 3500
      },
      "created_at": "2026-07-08T15:30:45.123Z"
    }
  ]
}
```

### SQL: Raw Queries

```sql
-- All critical events today
SELECT * FROM audit_log
WHERE workspace_id = 'ws-123'
  AND severity = 'CRITICAL'
  AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- Scoring history for PR #456
SELECT * FROM audit_log
WHERE workspace_id = 'ws-123'
  AND subject_id = 'pr-uuid'
  AND action IN ('pr_scored', 'scoring_retry', 'scoring_failed_exhausted')
ORDER BY created_at DESC;

-- All failed scoring attempts in last 7 days
SELECT 
  DATE(created_at) as date,
  COUNT(*) as failure_count,
  details ->> 'error_type' as error_type
FROM audit_log
WHERE workspace_id = 'ws-123'
  AND action IN ('scoring_retry', 'scoring_failed_exhausted')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), details ->> 'error_type'
ORDER BY date DESC;

-- Cost cap events (audit trail)
SELECT * FROM audit_log
WHERE workspace_id = 'ws-123'
  AND action IN ('cost_cap_reached', 'cost_cap_reset', 'cost_logged')
ORDER BY created_at DESC
LIMIT 100;

-- Admin actions (who changed what, when)
SELECT 
  user_id,
  details ->> 'action_type' as action_type,
  details as changes,
  created_at
FROM audit_log
WHERE workspace_id = 'ws-123'
  AND action = 'admin_action'
ORDER BY created_at DESC;
```

---

## Compliance Reporting

### API: Generate Compliance Report

**POST /api/audit/summary**

```bash
curl -X POST "http://localhost:3000/api/audit/summary" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws-123",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "reportType": "compliance"
  }'
```

**Response:**

```json
{
  "status": "ok",
  "report_type": "compliance",
  "report": {
    "period": "2026-01-01 to 2026-12-31",
    "workspace_id": "ws-123",
    "total_actions": 125432,
    "critical_events_count": 8,
    "scoring_actions_count": 45000,
    "disputes_count": 3,
    "admin_actions_count": 42,
    "cost_cap_events": 1,
    "secret_detections": 5,
    "summary": {
      "by_action": {
        "pr_scored": 44998,
        "scoring_retry": 142,
        "cost_logged": 45000,
        ...
      },
      "by_severity": {
        "INFO": 125000,
        "NOTICE": 400,
        "WARNING": 20,
        "ERROR": 8,
        "CRITICAL": 4
      },
      "by_source": {
        "api": 45100,
        "webhook": 80000,
        "poller": 200,
        ...
      }
    }
  }
}
```

---

## Retention & Archival

### Retention Policy (Default)

```sql
retain_logs_days: 2555         -- 7 years (SOC2)
retain_cost_logs_days: 2555    -- 7 years
retain_disputes_days: 2555     -- 7 years
retain_errors_days: 2555       -- 7 years
```

### Immutability Policy

```
require_immutable: TRUE
  → Audit entries cannot be modified or deleted (except soft-delete)
  
allow_deletion_by_admin: FALSE
  → Even admins cannot hard-delete audit entries
  → Only soft-delete (marks deleted_at, deleted_by, deletion_reason)
```

### Archive Strategy

1. **Hot:** Last 3 months in primary audit_log
2. **Warm:** 3-12 months in separate archive table (for compliance queries)
3. **Cold:** 1-7 years in cold storage (S3/tape, for legal holds)

---

## Forensic Examples

### Investigation: Did we score PR #456?

```sql
SELECT * FROM audit_log
WHERE workspace_id = 'ws-123'
  AND subject_id = 'pr-456'
  AND action = 'pr_scored'
ORDER BY created_at DESC
LIMIT 1;

-- Returns:
-- If found: Score details, cost, model, latency, exact timestamp
-- If not found: Either not scored yet, or error occurred
```

### Investigation: Why Did Scoring Fail?

```sql
SELECT * FROM audit_log
WHERE workspace_id = 'ws-123'
  AND subject_id = 'pr-789'
  AND action IN ('scoring_retry', 'scoring_failed_exhausted')
ORDER BY created_at DESC;

-- Returns: All retry attempts with error types, timestamps, final failure reason
```

### Investigation: Cost Spike on 2026-07-15

```sql
SELECT 
  details ->> 'cost_cents' as cost,
  details ->> 'scoring_model' as model,
  COUNT(*) as count
FROM audit_log
WHERE workspace_id = 'ws-123'
  AND DATE(created_at) = '2026-07-15'
  AND action = 'cost_logged'
GROUP BY details ->> 'cost_cents', details ->> 'scoring_model'
ORDER BY cost DESC;

-- Returns: Which model spent most? Which PRs were scored?
```

### Investigation: Secret Detected

```sql
SELECT * FROM audit_log
WHERE workspace_id = 'ws-123'
  AND action = 'secret_detected'
  AND severity = 'CRITICAL'
ORDER BY created_at DESC;

-- Returns: What secret? In which PR? When was it detected? Was it redacted?
```

---

## Security Best Practices

### Audit Log Access

- ✅ **Least Privilege:** Developers can't see audit log
- ✅ **Read-Only:** Managers can only view, not modify
- ✅ **Immutable:** Audit entries can't be deleted (except soft-delete with reason)
- ✅ **Traced:** Who did what, when, from where

### Log Protection

- ✅ **Encrypted at Rest:** Supabase auto-encrypts
- ✅ **Encrypted in Transit:** HTTPS only
- ✅ **Tamper-Evident:** Soft-delete shows who deleted and why
- ✅ **Backup:** Database backups include audit log

### Compliance

- ✅ **Retention:** 7 years default (meet SOC2, GDPR, PCI DSS)
- ✅ **Immutability:** Cannot modify past entries
- ✅ **Forensic:** Detailed timestamp + source + details
- ✅ **User Access:** Audit entries tied to user_id for GDPR compliance

---

## Monitoring & Alerting

### Query: Alert on Critical Events

```sql
-- Run hourly or daily
SELECT 
  COUNT(*) as critical_count,
  COUNT(DISTINCT DATE(created_at)) as days_with_critical
FROM audit_log
WHERE workspace_id = 'ws-123'
  AND severity = 'CRITICAL'
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND action NOT IN ('cost_cap_reached') -- Expected recurring event
GROUP BY workspace_id;

-- Alert if critical_count > 5 in 24h
```

### Query: Unusual Admin Activity

```sql
SELECT 
  DATE(created_at) as date,
  user_id,
  COUNT(*) as admin_action_count
FROM audit_log
WHERE workspace_id = 'ws-123'
  AND action = 'admin_action'
GROUP BY DATE(created_at), user_id
ORDER BY admin_action_count DESC;

-- Alert if single user > 50 actions in one day
```

---

## Integration with Phases

### Phase 4.1-4.2 (Scoring)
- ✅ `logPRScored()` on successful scoring
- ✅ Captures model version, tokens, cost, latency

### Phase 4.3 (Retry)
- ✅ `logScoringRetry()` on each retry attempt
- ✅ `logScoringFailurePermanent()` after max attempts

### Phase 4.4 (Aggregates)
- ✅ `logAdminAction()` when computing aggregates

### Phase 4.5 (Spend)
- ✅ `logCostRecorded()` per PR
- ✅ `logCostCapReached()` on cap trigger

### Phase 4.6 (Audit) ✅
- ✅ All above integrated
- ✅ Centralized audit trail
- ✅ Compliance reporting

---

## Next Steps

- Integration: Auto-alert on critical events
- Integration: Dashboard audit timeline
- Integration: GDPR data export (audit entries as proof of processing)
- Configuration: Archive cold storage after 1 year
- Configuration: Add digital signatures for immutability verification

---

## Terminology

| Term | Meaning |
|------|---------|
| **Action** | Type of event (pr_scored, admin_action, etc.) |
| **Severity** | How critical (INFO, WARNING, CRITICAL) |
| **Source** | Where it came from (api, webhook, system) |
| **Subject** | What it's about (pr, workspace, config) |
| **Immutable** | Cannot be changed or deleted (except soft-delete) |
| **Soft-Delete** | Mark as deleted (deleted_at), but keep data |
| **Audit Trail** | Complete history of events in order |
| **Forensic** | Detailed examination of what happened & why |
