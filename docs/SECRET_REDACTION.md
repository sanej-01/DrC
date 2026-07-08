# Secret Detection & Redaction — Phase 3.7

Complete guide to secret scanning and redaction in the PR ingestion pipeline.

---

## Overview

**Problem:** Developers might accidentally commit secrets to repositories:
- AWS Access Keys (AKIA...)
- GitHub Personal Access Tokens (ghp_...)
- Private Keys (BEGIN PRIVATE KEY)
- API Keys (Stripe, SendGrid, etc.)
- Database connection strings
- Slack webhooks

**Solution:** Scan every PR diff for secrets before enqueuing:
1. Detect secrets using regex patterns
2. Log security alert (severity: critical, high, medium)
3. Redact secrets from diff (replace with [REDACTED])
4. Still process PR (don't block)
5. Alert security team (if critical)

---

## Secret Types & Patterns

### CRITICAL Severity

Immediate credential exposure:

| Type | Pattern | Example |
|------|---------|---------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | AWS key starts with AKIA |
| GitHub Token | `ghp_[A-Za-z0-9_]{36,}` | GitHub token starts with ghp_ |
| GitHub OAuth Token | `gho_[A-Za-z0-9_]{36,}` | GitHub OAuth token starts with gho_ |
| Slack Webhook | Slack webhook URL pattern | Detected by fixed pattern |
| Private Key | `BEGIN RSA/EC/OPENSSH PRIVATE KEY` | `-----BEGIN RSA PRIVATE KEY-----` |

### HIGH Severity

API keys and tokens:

| Type | Pattern | Example |
|------|---------|---------|
| API Key (generic) | `api[-_]?key[=:]\s*[A-Za-z0-9_-]{20,}` | `api_key=sk_...` |
| Stripe Key | `sk_live_[A-Za-z0-9]{20,}` | Stripe live key pattern |
| SendGrid Key | `SG\.[A-Za-z0-9_-]{22,}` | SendGrid API key pattern |

### MEDIUM Severity

Possible credentials (less certain):

| Type | Pattern | Example |
|------|---------|---------|
| Database Connection | `postgres://user:pass@host/db` | `postgresql://admin:secret@db.example.com/prod` |
| Password in Env | `[Pp]assword[=:]\s*[^\s]+` | `PASSWORD=mySecretPassword123` |

---

## Workflow

### Secret Scanning Flow

```
1. Webhook received for merged PR
2. Extract PR metadata
3. Enqueue PR in database
4. Return 200 immediately (fast response)

--- Async (non-blocking) ---
5. Fetch PR diff from GitHub API
6. Scan diff against all secret patterns
7. If secrets found:
   a. Log to audit_log with details
   b. If CRITICAL: alert security team
   c. Redact secrets from diff ([REDACTED])
8. Use redacted diff for file-level disclosure
9. All actions logged
```

### Alert Recording

**audit_log entry:**
```json
{
  "action": "secret_detected",
  "subject_type": "pr",
  "subject_id": "pr-uuid",
  "details": {
    "pr_number": 123,
    "author": "developer",
    "findings": [
      {
        "type": "aws_access_key",
        "severity": "critical",
        "pattern": "AWS Access Key",
        "count": 2
      }
    ],
    "max_severity": "critical",
    "message": "Secret(s) detected in PR #123: AWS Access Key (2). Diff has been redacted."
  }
}
```

---

## Implementation Details

### Scanning

```typescript
const findings = scanDiffForSecrets(diff);
// Returns array of:
// { type, severity, pattern, count }

// Example result:
// [
//   { type: 'aws_access_key', severity: 'critical', pattern: 'AWS Access Key', count: 2 },
//   { type: 'github_token', severity: 'critical', pattern: 'GitHub Personal Access Token', count: 1 }
// ]
```

### Redaction

```typescript
const redacted = redactSecretsFromDiff(diff);
// Input:  ... aws_secret_access_key=AKIA... ...
// Output: ... aws_secret_access_key=[REDACTED] ...
```

### Alert Recording

```typescript
await recordSecretAlert(
  workspaceId,
  prId,
  findings,
  prNumber,
  author
);
// Logs to audit_log, may trigger external alerts
```

---

## Developer Experience

### When Secrets Detected

Developer sees:

```
PR #123 — Add new environment config
⚠️ Critical: Secrets detected

This PR contains sensitive information that has been redacted:
- AWS Access Key (2 occurrences)
- GitHub Personal Access Token (1 occurrence)

Action required:
1. Revoke the exposed credentials immediately
2. Force-push a clean version (remove secrets)
3. Consider this PR compromised

Security team has been notified.
```

### Getting Security Report

```
GET /api/security/pr/{prId}
// Returns:
{
  "has_secrets": true,
  "findings": [
    { "type": "aws_access_key", "severity": "critical", "pattern": "AWS Access Key", "count": 2 }
  ],
  "timestamp": "2026-07-08T20:30:00Z"
}
```

---

## Security Considerations

### What We Don't Store

❌ **Never stored:**
- Raw diff with secrets
- Secret values
- Commit message bodies (might contain pasted secrets)
- Credentials in logs

✅ **What we store:**
- Alert metadata (type, severity, count)
- Pattern matches (not actual values)
- Redacted diff for file disclosure

### Pattern Limitations

**False negatives (missed secrets):**
- Custom secret formats not in list
- Secrets in comments (not code)
- Encoded secrets (base64, encrypted)

**Mitigation:**
- Pre-commit hook on developer machines (catch before push)
- Regular pattern updates
- Security team review for sensitive repos

### Scope

Secrets scanned:
- PR diff (all additions)
- NOT: commit history, tags, comments
- NOT: after merge (only at enqueue time)

---

## Configuration

### Add New Pattern

Edit `lib/secret-scanner.ts`:

```typescript
const SECRET_PATTERNS = {
  // ... existing patterns
  
  custom_token: {
    regex: /CUSTOM_[A-Z0-9]{32}/g,
    description: "Custom Token",
    severity: "high" as const,
  },
};
```

### Adjust Severity

Change severity level if needed:

```typescript
// Make Stripe keys CRITICAL instead of HIGH
stripe_key: {
  regex: /(sk_live_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,})/g,
  description: "Stripe API Key",
  severity: "critical" as const,  // Changed from "high"
},
```

### Disable Pattern

Comment out patterns that cause false positives:

```typescript
// Disabled: Too many false positives in API docs
// api_key_generic: {
//   regex: /(["\']?[Aa][Pp][Ii][-_]?[Kk][Ee][Yy]["\']?[\s:=]+["\']?[A-Za-z0-9_\-]{20,}["\']?)/g,
//   description: "API Key (generic pattern)",
//   severity: "high" as const,
// },
```

---

## Monitoring & Alerting

### Check Recent Secrets

```sql
SELECT pr_number, author, max_severity, message
FROM audit_log
WHERE action = 'secret_detected'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Alert on Critical Secrets

```sql
-- Count by severity
SELECT details->>'max_severity' as severity, COUNT(*) as count
FROM audit_log
WHERE action = 'secret_detected'
AND created_at > NOW() - INTERVAL '1 day'
GROUP BY severity;

-- Expected output:
-- critical | 3
-- high     | 7
-- medium   | 12
```

### Integration with External Systems

For CRITICAL secrets, trigger:
- Slack notification to #security
- Email to security@company.com
- PagerDuty alert (if credential rotations needed)

Example alert message:
```
🚨 CRITICAL SECRET DETECTED
PR: platform-squad/backend#123
Author: alice
Secrets: AWS Access Key (2x), GitHub Token (1x)
Action: Revoke credentials immediately
```

---

## FAQ

**Q: What if a secret is detected in a false positive (like a test key)?**
- A: Still alert (better safe than sorry). Developer can:
  1. Regenerate clean version
  2. Or if truly test data, confirm with security team

**Q: Can I scan commit history?**
- A: Not in Phase 3.7 (too expensive, long history). Use `git-secrets` or similar tool locally.

**Q: Does secret scanning block the PR from being scored?**
- A: No. PR is still enqueued and scored. But alert is recorded.

**Q: What if I committed a secret before this feature?**
- A: Secret scanning only covers new PRs (going forward). Audit old history separately.

**Q: Can developers disable secret scanning?**
- A: No. It's part of the pipeline and can't be bypassed.

**Q: What about secrets in PR descriptions or comments?**
- A: Not scanned yet (Phase 3.7 only scans diffs). Consider for future phase.

---

## Compliance

### GDPR

- Secrets are not stored in plaintext
- Audit trail is logged (for compliance review)
- No automatic sharing with external services (unless configured)

### SOC2

- All secret detections are logged to audit_log
- Alerts are timestamped and immutable
- Can audit who accessed security reports

### PCI DSS

- Database credentials are detected and redacted
- Configuration prevents credential storage

---

## Next Steps

- Phase 4: Scoring (LLM scoring of enqueued PRs)
- Phase 5: Developer dashboard (display security alerts)
- Future: Secret scanning in commit history, commit messages
