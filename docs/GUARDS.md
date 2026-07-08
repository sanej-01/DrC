# Ingestion Pipeline Guards — Phase 3.6

Complete guide to guards, alerts, and disclosures for the PR ingestion pipeline.

---

## Overview

**Problem:** Some PRs are edge cases that require special handling:
- Empty PRs (no files changed) — skip scoring, no LLM call
- Draft PRs (still being worked on) — skip scoring
- Large PRs (500+ files, 10k+ lines) — score but alert, show file-level disclosure

**Solution:** Guards detect these cases and:
1. Log alerts for transparency
2. Skip scoring when appropriate
3. Record file-level disclosure for large PRs
4. All non-blocking (don't delay webhook response)

---

## Guard Types

### 1. Empty Diff Guard (TC-EDG-009)

**Trigger:** PR has 0 files changed

**Behavior:**
- Alert: `alert_type: 'empty_diff'`
- Skip scoring: Yes
- Disclosure: No files to disclose
- Message: "PR has no file changes (0 files). Scoring skipped."

**Example:**
```
PR #42: Merge branch 'main' into feature
- Files changed: 0
- Status: Enqueued but not scored
- Alert: empty_diff
```

---

### 2. Draft Guard (TC-ING-007)

**Trigger:** PR is still a draft (shouldn't happen via webhook, but double-check)

**Behavior:**
- Alert: `alert_type: 'draft_pr'`
- Skip scoring: Yes
- Disclosure: No files to disclose
- Message: "PR is still a draft. Scoring skipped."

**Example:**
```
PR #99: WIP: New API endpoint
- Status: Draft
- Status: Enqueued but not scored
- Alert: draft_pr
```

---

### 3. Large PR Guard (TC-ING-006)

**Trigger:** PR exceeds size threshold
- Files changed: > 500
- **OR** Lines changed: > 10,000 (additions + deletions)

**Behavior:**
- Alert: `alert_type: 'large_pr'`, `severity: 'warning'`
- Skip scoring: No (still scored, but with disclosure)
- Disclosure: Yes (file-level breakdown)
- Message: "Large PR detected: X files, Y lines changed. Only first 200 files will be fully scored. File-level disclosure available."

**Example:**
```
PR #123: Major refactor: Extract common utilities
- Files changed: 847
- Lines changed: 25,432
- Status: Scored with disclosure
- Alert: large_pr (warning)

File disclosure:
- Scored: 200 files (2,413 lines)
- Omitted: 647 files (23,019 lines)

Breakdown (scored files):
  - utils/string.ts: +150 -50
  - utils/math.ts: +200 -30
  - utils/array.ts: +175 -40
  ... (197 more files)
```

---

## Database Schema

### `pr_scoring_alerts` table

```sql
CREATE TABLE pr_scoring_alerts (
  id UUID,
  workspace_id UUID,
  pr_id UUID UNIQUE,
  alert_type TEXT, -- 'empty_diff', 'draft_pr', 'large_pr', 'rate_limit', etc.
  severity TEXT, -- 'warning', 'error', 'info'
  message TEXT, -- Human-readable message
  details JSONB, -- Extra data: { files_changed: 847, lines_changed: 25432, ... }
  created_at TIMESTAMP
);
```

### `pr_scored_files` table

```sql
CREATE TABLE pr_scored_files (
  id UUID,
  pr_id UUID,
  file_path TEXT, -- e.g., "src/utils/string.ts"
  included_in_scoring BOOLEAN, -- true=scored, false=omitted
  additions INTEGER,
  deletions INTEGER,
  changes INTEGER, -- additions + deletions
  created_at TIMESTAMP
);
```

---

## Developer Experience

### Viewing Alerts

For a large PR, developer sees:

```
PR #123 — Major Refactor
⚠️ Warning: Large PR

This PR is quite large (847 files, 25k+ lines changed).
We've scored the first 200 files in detail.
The remaining 647 files were not fully analyzed due to size.

View file disclosure →
```

### Viewing File Disclosure

Developer can see which files were scored:

```
File Scoring Breakdown

Scored (200 files, 2,413 changes):
✓ src/utils/string.ts (+150, -50)
✓ src/utils/math.ts (+200, -30)
✓ src/utils/array.ts (+175, -40)
... (197 more files)

Omitted (647 files, 23,019 changes):
- src/components/old/... (deprecated, not analyzed)
- build/ (generated, not analyzed)
... (645 more files)

Note: This PR's score is based on the 200 scored files.
For a complete review of all 847 files, please ask a team member.
```

---

## Configuration

### Size Thresholds

Edit `lib/guards.ts`:

```typescript
// Trigger alert if > 500 files
const LARGE_PR_FILE_THRESHOLD = 500;

// Trigger alert if > 10,000 lines changed
const LARGE_PR_LINES_THRESHOLD = 10000;

// Score only first 200 files
const FILE_SCORE_LIMIT = 200;
```

### Severity Levels

- `info` — Informational only (didn't affect scoring)
- `warning` — Alert issued, but scoring proceeded (large PR)
- `error` — Scoring failed (rate limit, timeout)

---

## Workflow

### Webhook → Guards Flow

```
1. Webhook received
2. Extract PR metadata
3. Enqueue PR in database
4. Return 200 immediately (fast response)

--- Async (non-blocking) ---
5. Run guards (checkSkipScoring, checkLargePR)
6. Record alert if needed
7. For large PRs: fetch diff, parse files, record disclosure
8. All logged to audit_log
```

### Query Alert Status

```sql
-- Get all alerts for a PR
SELECT * FROM pr_scoring_alerts WHERE pr_id = 'uuid';

-- Get alerts by type
SELECT * FROM pr_scoring_alerts
WHERE alert_type = 'large_pr'
AND severity = 'warning';

-- Get recent alerts in workspace
SELECT * FROM pr_scoring_alerts
WHERE workspace_id = 'uuid'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Query File Disclosure

```sql
-- Get scored vs omitted files
SELECT 
  included_in_scoring,
  COUNT(*) as count,
  SUM(changes) as total_changes
FROM pr_scored_files
WHERE pr_id = 'uuid'
GROUP BY included_in_scoring;

-- Get file details for a large PR
SELECT file_path, included_in_scoring, changes
FROM pr_scored_files
WHERE pr_id = 'uuid'
ORDER BY changes DESC
LIMIT 20;
```

---

## Monitoring

### Check Guard Execution

```sql
-- See all alerts created in last 24 hours
SELECT alert_type, severity, COUNT(*) as count
FROM pr_scoring_alerts
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY alert_type, severity;

-- Check for failed disclosures
SELECT pr_id, alert_type, message
FROM pr_scoring_alerts
WHERE alert_type = 'large_pr'
AND pr_id NOT IN (SELECT DISTINCT pr_id FROM pr_scored_files);
```

### Audit Trail

All guard actions logged to `audit_log`:

```sql
SELECT * FROM audit_log
WHERE action LIKE 'guard_%'
ORDER BY created_at DESC;
```

---

## FAQ

**Q: Why skip scoring for empty PRs?**
- A: No code to analyze. Scoring would be meaningless. Saves LLM cost.

**Q: Can I disable the large PR alert?**
- A: Yes, increase thresholds in `lib/guards.ts`. But disclosure helps developers understand why score might be limited.

**Q: What if file disclosure fails?**
- A: Alert is still recorded. Disclosure is best-effort (doesn't block scoring).

**Q: Are large PRs scored differently?**
- A: No. Score is based on the 200 scored files, same logic as normal PRs. Message tells developer which files were analyzed.

**Q: Can I view disclosures in the UI?**
- A: Yes (Phase 5: Developer dashboard). For now, query `pr_scored_files` table.

**Q: What about drafts merged before converting?**
- A: Webhook fires only for merged PRs. Draft check is defensive (double-check).

---

## Next Steps

- Phase 3.7: Secret redaction (scan diffs for secrets, redact before queue)
- Phase 4: Scoring (LLM scoring of enqueued PRs)
- Phase 5: Developer experience (display alerts, file disclosure in dashboard)
