# Manager Manual GitHub Scan Feature

Managers can manually trigger GitHub PR scans for their workspace from the dashboard.

---

## Overview

**Feature**: One-click manual GitHub PR scanning
**Who**: Managers and admins only
**Where**: Manager dashboard
**When**: On-demand (no automatic scheduling)
**Purpose**: Catch missed webhooks, trigger backfill, recover from outages

---

## User Guide

### Triggering a Manual Scan

1. **Navigate to Team Dashboard**
   - Go to `/app/manager/team`

2. **Click "Scan GitHub Now" Button**
   - Located in the top-right corner
   - Shows a search icon + text label

3. **Wait for Results**
   - Button shows spinner during scan (2-30 seconds)
   - Results display when complete

### Understanding Results

**Result Grid (4 columns)**:
- **Repos Scanned**: Number of repositories checked
- **PRs Checked**: Total merged PRs examined
- **PRs Enqueued**: New PRs added to scoring queue
- **Duplicates Skipped**: Already-scored PRs (no re-scan)

**Details Section** (click to expand):
- Per-repository breakdown
- Repos scanned, PRs enqueued per repo
- Helps identify issues with specific repos

**Error Section** (if any):
- Lists any repositories that failed
- Reasons why (GitHub token expired, API error, etc.)

**Notification**:
- Shows "X PRs added to scoring queue"
- These will be scored within 2 minutes

---

## Technical Details

### API Endpoint

**POST /api/manager/scan-github**

```bash
curl -X POST https://app.dr-codium.com/api/manager/scan-github \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <manager-auth-token>" \
  -d '{"workspaceId": "ws-abc123"}'
```

**Response**:
```json
{
  "workspace_id": "ws-abc123",
  "timestamp": "2026-07-20T10:30:00Z",
  "repos_scanned": 3,
  "prs_checked": 47,
  "prs_enqueued": 2,
  "prs_duplicated": 5,
  "repos": [
    {
      "repo_id": "github-repo-1",
      "prs_checked": 20,
      "prs_enqueued": 1,
      "prs_duplicated": 3
    }
  ],
  "errors": []
}
```

### Authorization

**Who can scan**:
- ✅ Workspace managers
- ✅ Workspace admins
- ❌ Developers (blocked at API level)
- ❌ Non-members (blocked)

**Verification**:
- Checked via RLS policy
- Workspace isolation enforced
- Audit logged

### Performance

**Typical Duration**: 5-30 seconds
- Depends on number of repos
- Depends on GitHub API rate limits
- Scanning only (no re-scoring)

**Concurrency**:
- One scan per workspace at a time
- Button disabled during scan
- Can run other operations meanwhile

---

## Use Cases

### Weekly Maintenance

Run every Monday morning as insurance against missed webhooks:

```bash
# Add to personal cron job or calendar reminder
# Every Monday at 9 AM trigger scan
```

### After GitHub App Issues

If GitHub App webhook delivery had issues:
1. Click "Scan GitHub Now"
2. Review "PRs Enqueued" count
3. Wait 2 minutes for scoring
4. Verify scores appear in dashboard

### Webhook Outage Recovery

If webhooks were down for a period:
1. Manager triggers manual scan
2. All missed PRs from outage period are queued
3. Scoring catches up automatically

### New Workspace Setup

When linking new GitHub repos:
1. Add repos to workspace
2. Trigger manual scan
3. All existing merged PRs backfilled
4. Developers see historical scores

### Audit/Verification

Verify all PRs have been processed:
1. Trigger scan
2. If `prs_enqueued` == 0, all caught up
3. If > 0, indicates missed webhooks

---

## Troubleshooting

### "Scan Failed" Error

**Issue**: Scan returned an error

**Possible Causes**:
- GitHub OAuth token expired
- GitHub API rate limit exceeded
- Network connectivity issue
- Invalid workspace ID

**Solution**:
1. Verify GitHub App is still installed
2. Verify workspace admin has authorized GitHub OAuth
3. Wait 1 hour for rate limit reset
4. Try again

### No PRs Enqueued

**Issue**: Scan ran but found no new PRs

**Possible Causes**:
- All PRs already scored
- No new merged PRs since last check
- GitHub API didn't return recent PRs

**Solution**:
- Expected behavior if all PRs scored
- Create test PR to verify system working

### Scan Takes Too Long

**Issue**: Scan spinning for >30 seconds

**Possible Causes**:
- Large number of repos
- GitHub API slow
- Network latency

**Solution**:
- Wait for completion (up to 60 seconds)
- If timeout, try again later
- Contact support if consistently slow

### "Only managers can scan" Error

**Issue**: Non-manager user tried to scan

**Solution**:
- Only managers/admins can trigger scans
- Developers should contact manager
- Manager can trigger scan as needed

---

## Monitoring

### Check Scan History

**Via API**:
```bash
curl https://app.dr-codium.com/api/manager/scan-github?workspaceId=ws-abc123 \
  -H "Authorization: Bearer <auth-token>"
```

**Response**:
```json
{
  "workspace_id": "ws-abc123",
  "scans": [
    {
      "timestamp": "2026-07-20T10:30:00Z",
      "repos_scanned": 3,
      "prs_enqueued": 2,
      "prs_duplicated": 0
    }
  ]
}
```

### Audit Log

Scan triggers are logged in audit trail:
- Action: `manual_scan_triggered`
- Details: repos_scanned, prs_enqueued, prs_duplicated
- User: Manager who triggered scan
- Timestamp: When scan ran

---

## Limitations

**Current Behavior**:
- ✅ One scan per workspace
- ✅ Button disabled during scan
- ✅ Results persist until next action
- ⚠️ Can't cancel mid-scan
- ⚠️ No email notification (only in-app)

**Planned Features**:
- 📋 Scheduled automatic scans (future)
- 📧 Email notifications on completion
- 📊 Scan history dashboard
- ⏰ Estimated time remaining

---

## Best Practices

### Weekly Routine

```
Every Monday morning:
1. Open manager dashboard
2. Click "Scan GitHub Now"
3. Review results
4. Note if prs_enqueued > 0 (indicates webhook issues)
5. Wait 2 minutes for scoring
6. Spot-check dashboard for new scores
```

### After Events

- After GitHub App re-installation → scan immediately
- After service outage → scan to recover
- After large merge → scan to catch any
- After workspace changes → scan to verify

### Avoiding Redundant Scans

- Webhooks handle 99% automatically
- Only scan if suspect issues
- Weekly is usually sufficient
- Scanning is cheap but unnecessary scans are wasteful

---

## Integration with CI/CD

Automate weekly scans via GitHub Actions:

```yaml
name: Weekly GitHub Scan
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9 AM UTC

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger manual scan
        env:
          WORKSPACE_ID: ${{ secrets.WORKSPACE_ID }}
          MANAGER_TOKEN: ${{ secrets.MANAGER_TOKEN }}
        run: |
          curl -X POST https://app.dr-codium.com/api/manager/scan-github \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $MANAGER_TOKEN" \
            -d "{\"workspaceId\": \"$WORKSPACE_ID\"}"
```

---

## FAQ

**Q: Will manual scans double-score PRs?**
A: No. Deduplication prevents re-scoring. Already-scored PRs are skipped.

**Q: How often should I scan?**
A: Weekly is sufficient for insurance. More frequent only if investigating issues.

**Q: Can developers scan?**
A: No. Only managers and admins can trigger scans.

**Q: What if I click scan twice?**
A: Second click is ignored (button disabled during first scan).

**Q: Do webhooks still work during manual scan?**
A: Yes. Both happen independently.

**Q: How long does a scan take?**
A: Typically 5-30 seconds. Up to 60 seconds for large workspaces.

**Q: What if scan fails?**
A: Error message shows issue. Try again or contact support.

**Q: Are scans logged?**
A: Yes. All scans logged to audit trail with timestamp and results.

**Q: Can I see scan history?**
A: Yes. Via API or audit log. UI history dashboard coming soon.

---

## Support

**Issue?** Contact your workspace admin or support team.

**For development**: See `docs/MANUAL_SCANNING.md` for admin/API details.
