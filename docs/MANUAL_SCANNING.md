# Manual Scanning Guide

Dr. Codium now supports **manual-only** GitHub PR scanning. There is no automatic cron job.

---

## Overview

Instead of a background job polling GitHub every 5 minutes, manual scanning allows you to:
- Trigger PR scans on-demand
- Control scanning frequency
- Avoid unnecessary API calls
- Reduce operational overhead

**Triggers**:
- Webhook delivery (automatic via GitHub App)
- Manual scan endpoint (on-demand)
- Admin dashboard button (future feature)

---

## How It Works

### Primary: GitHub Webhook

When a PR is opened/closed/merged on GitHub:
1. GitHub App receives webhook
2. Webhook triggers `/api/webhooks/github`
3. PR is enqueued for scoring
4. Score computed and stored

**This is automatic** - no manual action needed for normal operation.

### Fallback: Manual Scan

If webhooks are missed or delayed:
1. Admin manually triggers scan
2. Polls all GitHub repos in workspace
3. Finds merged PRs not yet scored
4. Enqueues them for scoring
5. Deduplication prevents double-scoring

---

## Trigger Manual Scan

### Via curl

```bash
# Trigger manual scan
curl -X POST https://app.dr-codium.com/api/cron/poll-github \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"

# Response:
{
  "workspaces_polled": 2,
  "repos_polled": 5,
  "prs_checked": 47,
  "prs_enqueued": 3,
  "prs_duplicated": 0,
  "errors": []
}
```

### Via Admin Dashboard (Future)

*Coming in Phase 11.2*
- Admin UI button: "Scan GitHub Now"
- Shows scan progress and results
- Logs scan history

### Via CLI Script

Create `scripts/manual-scan.sh`:

```bash
#!/bin/bash
# Manual GitHub scan

PROD_URL="https://app.dr-codium.com"
CRON_SECRET="${CRON_SECRET}"

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET not set"
  echo "Usage: CRON_SECRET=... ./scripts/manual-scan.sh"
  exit 1
fi

echo "Triggering manual scan..."
curl -X POST "$PROD_URL/api/cron/poll-github" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo "Scan completed!"
```

Usage:
```bash
chmod +x scripts/manual-scan.sh
CRON_SECRET=your_secret ./scripts/manual-scan.sh
```

---

## When to Manual Scan

**Regular Use** (Weekly Maintenance):
- Once per week to catch any missed webhooks
- After GitHub App re-installation
- After extended outage

**Troubleshooting**:
- PR shows in GitHub but not in dashboard → Manual scan
- Score generation stalled → Manual scan
- Webhook delivery failures → Manual scan

**One-Time Backfill**:
- New GitHub App installation
- Migrating from another system
- Auditing missed PRs

---

## Configuration

### Environment Variables

Ensure these are set in `.env` or Vercel:

```
CRON_SECRET=your_random_32_char_secret
```

### Vercel Setup

The cron job has been **disabled**:

```json
{
  "crons": []
}
```

No automatic scheduling occurs. Manual triggers only.

---

## API Reference

### Endpoint: `POST /api/cron/poll-github`

**Description**: Manually trigger GitHub PR polling across all workspaces

**Authentication**: Bearer token (CRON_SECRET)

**Request**:
```bash
POST /api/cron/poll-github HTTP/1.1
Authorization: Bearer sk-cron-secret-here
Content-Type: application/json
```

**Response** (200 OK):
```json
{
  "workspaces_polled": 2,
  "repos_polled": 8,
  "prs_checked": 156,
  "prs_enqueued": 5,
  "prs_duplicated": 0,
  "errors": []
}
```

**Errors**:
- `401 Unauthorized` - Invalid/missing CRON_SECRET
- `500 Internal Server Error` - Failed to connect to GitHub or database

### Response Fields

| Field | Type | Meaning |
|-------|------|---------|
| `workspaces_polled` | int | Number of workspaces checked |
| `repos_polled` | int | Total repos across workspaces |
| `prs_checked` | int | PRs checked for scoring status |
| `prs_enqueued` | int | New PRs added to scoring queue |
| `prs_duplicated` | int | PRs already scored (skipped) |
| `errors` | array | Any errors during polling |

---

## Monitoring

### Check Scan Status

Query the database to see when last scan occurred:

```sql
-- Most recent scan operations
SELECT 
  action,
  subject_type,
  subject_id,
  created_at,
  details
FROM audit_log
WHERE action = 'manual_scan' OR action = 'cron_triggered'
ORDER BY created_at DESC
LIMIT 20;
```

### Monitor Enqueued PRs

```sql
-- PRs waiting to be scored
SELECT COUNT(*) as waiting_count
FROM scoring_queue
WHERE status = 'pending';

-- Average queue wait time
SELECT 
  AVG(EXTRACT(EPOCH FROM (scored_at - created_at))) as avg_wait_seconds
FROM scoring_queue
WHERE status = 'completed'
AND scored_at > NOW() - INTERVAL '7 days';
```

---

## Troubleshooting

### "Unauthorized" Error (401)

**Issue**: Invalid CRON_SECRET

**Solution**:
1. Verify CRON_SECRET is set in Vercel env vars
2. Ensure secret is correct in curl command
3. Regenerate secret if needed

**Test**:
```bash
echo $CRON_SECRET
# Should output your secret (not empty)
```

### No PRs Enqueued (0 Results)

**Issue**: Manual scan ran but found no new PRs

**Possible Causes**:
- All PRs already scored
- No merged PRs since last check
- GitHub App not installed properly

**Verify**:
```bash
# Check if GitHub App is still installed
# Go to repo Settings → Apps & Integrations
# Should see "Dr. Codium" app listed
```

### "Failed to connect to GitHub"

**Issue**: Scan couldn't reach GitHub API

**Possible Causes**:
- GitHub API token expired/revoked
- Network connectivity issue
- GitHub API rate limit exceeded

**Solution**:
1. Check GitHub API status: https://www.githubstatus.com/
2. Verify GitHub OAuth token is still valid
3. Wait 1 hour for rate limit reset
4. Retry manual scan

### Duplicate Scoring

**Issue**: Same PR scored twice

**Prevention**: Endpoint uses UNIQUE constraint to prevent duplicates
- If `prs_duplicated > 0`, those PRs were skipped
- No duplicate costs incurred
- Scoring queue deduplicates automatically

---

## Best Practices

### Weekly Maintenance

Schedule weekly manual scans as insurance:

```bash
# Add to your personal cron (Linux/Mac)
0 9 * * 1 CRON_SECRET=... curl -X POST https://app.dr-codium.com/api/cron/poll-github -H "Authorization: Bearer $CRON_SECRET"
```

### After Events

Trigger manual scan after:
- GitHub App re-installation
- Extended service outages
- Large webhook delivery delays
- Workspace migration

### Monitoring & Alerts

Set up alerting for:
- Scoring queue grows beyond 50 PRs
- Manual scan fails 3 times
- Webhook delivery rate drops

---

## Cost Impact

**Savings from Manual-Only**:
- No automatic API calls every 5 minutes
- Reduced Groq API costs (~$0.01 per scan)
- Estimated savings: $40-100/month (if run weekly)

**Trade-off**:
- Slightly delayed scoring for missed webhooks
- Requires manual intervention for backfill
- Better control over scanning frequency

---

## Comparison: Automatic vs Manual

| Feature | Automatic Cron | Manual Only |
|---------|---|---|
| Webhook handling | Immediate | Immediate |
| Missed webhook recovery | 5-minute fallback | Manual trigger |
| Frequency | Every 5 minutes | On-demand |
| Cost | Higher (frequent calls) | Lower (manual only) |
| Setup complexity | Vercel config | Simple endpoint |
| Debugging | Harder (background job) | Easier (HTTP logs) |
| Scalability | Limited | Better (on-demand) |

---

## Migration from Automatic

If upgrading from automatic cron:

**Changes Made**:
- ✅ Removed cron from `vercel.json`
- ✅ Changed endpoint to `POST` (was `GET`)
- ✅ Endpoint remains at `/api/cron/poll-github`

**No User Impact**:
- Webhooks still work automatically
- Only fallback polling is manual now
- Existing integrations unaffected

**During Transition**:
- First week: Run manual scan daily while testing
- Week 2+: Run weekly as insurance
- Monitor PR scoring latency

---

## FAQ

**Q: Will my PRs still get scored?**
A: Yes! Webhooks handle 99% of cases. Manual scan is just backup.

**Q: How often should I run manual scan?**
A: Weekly maintenance is sufficient. More if you suspect webhook failures.

**Q: What if I forget to run manual scan?**
A: Webhooks will catch almost everything. Worst case: slight delay in scoring.

**Q: Can I automate this elsewhere?**
A: Yes! Use GitHub Actions, Lambda, or any cron system to call the endpoint.

**Q: What about existing scans?**
A: All historical scans remain. Only future scheduling is manual.

**Q: Can I switch back to automatic?**
A: Yes, but need Vercel cron. Edit `vercel.json` and re-add schedule.

---

## Resources

- **API Reference**: `/api/cron/poll-github` endpoint
- **curl Documentation**: https://curl.se/
- **GitHub API Status**: https://www.githubstatus.com/
- **Vercel Cron Docs**: https://vercel.com/docs/cron-jobs (reference only)
