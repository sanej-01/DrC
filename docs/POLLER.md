# GitHub Poller (5-Minute Fallback) — Phase 3.5

Complete guide to the poller mechanism for catching missed webhooks.

---

## Overview

**Problem:** GitHub webhooks can occasionally fail to deliver (network issues, server downtime, etc.)

**Solution:** Vercel Cron job polls GitHub every 5 minutes for merged PRs not yet in database

**Result:** Idempotent fallback ensures all PRs are eventually enqueued

---

## Architecture

### Poller Flow

```
Every 5 minutes:
1. Vercel Cron triggers GET /api/cron/poll-github
2. Verify CRON_SECRET (Vercel-provided)
3. For each workspace:
   a. Get all linked repositories
   b. Fetch recent merged PRs (last 24 hours)
   c. Check pr_node_id against database (dedup)
   d. Enqueue new PRs
   e. Log results to poller_job_log
4. Return summary (prs_checked, prs_enqueued, prs_duplicated)
```

### Deduplication

- **By pr_node_id:** Unique GraphQL node ID
- **Conflict handling:** If concurrent webhook arrives, DB UNIQUE constraint handles dedup
- **Idempotent:** Running poller multiple times is safe

### Efficiency

- Poll only last 24 hours (high-frequency)
- Backfill is separate (one-time, 90-day, lower priority)
- Pagination: 100 PRs per request
- Early exit: Stop pagination if no new PRs

---

## Setup & Configuration

### Environment Variables

Add to `.env.local`:

```env
# Vercel Cron secret (set in Vercel dashboard)
CRON_SECRET=<your-cron-secret>
```

### Vercel Configuration

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/poll-github",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedule explanation:**
- `*/5` = every 5 minutes
- `*` = every hour
- `* *` = every day
- `* * *` = every month
- `* * * *` = every year

### Deployment

```bash
# Local testing
npm run dev
# Visit http://localhost:3000/api/cron/poll-github (with CRON_SECRET header)

# Deploy to Vercel
git push origin main
# Vercel will automatically set up cron based on vercel.json
```

---

## Database Schema

### `poller_metadata` table
- Tracks last poll time per repo
- Stores pagination state (last_fetched_pr_id)
- Monitors poller health (status, error_message)

### `poller_job_log` table
- Detailed log of each poller run
- Tracks prs_checked, prs_enqueued, prs_duplicated
- Used for monitoring and debugging

---

## Monitoring & Debugging

### Check Last Poll Time

```sql
SELECT 
  repo_id, 
  last_poll_at, 
  next_poll_at, 
  status, 
  error_message,
  prs_enqueued
FROM poller_metadata
ORDER BY last_poll_at DESC;
```

### View Poll History

```sql
SELECT 
  workspace_id,
  repo_id,
  poll_started_at,
  poll_completed_at,
  status,
  prs_checked,
  prs_enqueued,
  prs_duplicated,
  error_message
FROM poller_job_log
WHERE poll_started_at > NOW() - INTERVAL '24 hours'
ORDER BY poll_started_at DESC;
```

### Verify Cron is Running

1. Go to Vercel dashboard → Project → Crons
2. Should see "poll-github" with status "OK"
3. Check "Recent Runs" for execution history

### Check Poller Logs

In Vercel dashboard → Deployments → Function Logs:
```
GET /api/cron/poll-github 200 1.2s
Poller cron run completed: {workspaces_polled: 3, repos_polled: 12, prs_enqueued: 5, ...}
```

### Troubleshooting

**Cron not running:**
- Verify CRON_SECRET is set in Vercel dashboard
- Check vercel.json is in root directory
- Redeploy: `git push origin main`

**Low prs_enqueued:**
- Normal! Most PRs come via webhook (faster)
- Poller catches rare webhook failures
- High enqueued count = many webhook failures (investigate webhook health)

**High prs_duplicated:**
- Expected behavior (webhook + poller both deliver same PR)
- Indicates webhook is working well
- Dedup by pr_node_id prevents scoring duplicates

**Poller stuck (no recent last_poll_at):**
- Check Vercel logs for errors
- Verify GitHub API access (token, rate limits)
- Check workspace has repos linked
- Manually retry: call `/api/cron/poll-github` with CRON_SECRET

---

## Performance & Cost

### GitHub API Quota

- Poller makes 1 API call per repo per 5 minutes
- 3 workspaces × 5 repos each = 15 calls/5 min = 180 calls/hour
- GitHub rate limit: 5,000/hour (plenty of headroom)

### Processing Time

- Per-repo poll: ~500ms (fetch + dedup + insert)
- 12 repos: ~6 seconds
- Well within Vercel Function timeout (30s)

### Database Cost

- poller_metadata: 1 row per repo (tiny)
- poller_job_log: 12 rows per 5 minutes = ~3,500 rows/day (minimal)

---

## Webhook vs Poller

| Aspect | Webhook | Poller |
|--------|---------|--------|
| **Latency** | <1s | 0-5 min |
| **Reliability** | ~99% | 100% (fallback) |
| **Coverage** | New PRs only | Last 24h |
| **Cost** | Free | ~180 API calls/hour |
| **Complexity** | Simple | Stateful (poller_metadata) |

**Best practice:** Webhook for real-time, poller as safety net

---

## Vercel Cron Best Practices

### Security

- CRON_SECRET is cryptographically random (set by Vercel)
- Vercel passes it in Authorization header (HTTPS only)
- Endpoint verifies secret before processing
- Never hardcode secret in code

### Reliability

- Cron retries failed jobs (Vercel-managed)
- Poller is idempotent (safe to retry)
- Logs all results for debugging

### Monitoring

- Use `console.log()` for key events (goes to Vercel logs)
- Monitor poller_job_log for trends
- Alert on: high error_message rate, prs_checked = 0

---

## Next Steps

- Phase 3.6: Guards (draft/sync ignored, empty-diff skip)
- Phase 3.7: Secret redaction (scan diffs for secrets)
- Phase 4: Scoring (LLM scoring of enqueued PRs)

---

## FAQ

**Q: What if webhook arrives while poller runs?**
- A: Database UNIQUE constraint on pr_node_id handles dedup. One insert succeeds, other fails with 23505 (duplicate). Poller catches the duplicate and continues.

**Q: Does poller re-score already-scored PRs?**
- A: No. Poller only enqueues in pull_requests table. Scoring is separate phase.

**Q: Can I manually trigger poller?**
- A: Yes, call `/api/cron/poll-github` with Authorization header:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    https://app.vercel.app/api/cron/poll-github
  ```

**Q: What if workspace has no GitHub tokens?**
- A: Poller logs warning, skips workspace, continues. Backfill will prompt for token when needed.

**Q: How long does poller keep history?**
- A: poller_job_log grows unbounded. Consider archiving old entries after 30 days in production.
