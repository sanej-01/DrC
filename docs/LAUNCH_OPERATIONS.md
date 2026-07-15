# Launch Operations Guide — Phase 11.1

Day-to-day operations, monitoring, and incident response after public launch.

---

## Overview

Launch operations focuses on keeping Dr. Codium running smoothly, responding to issues, and supporting users in production.

**Coverage**: Monitoring, alerting, incident response, on-call rotation
**Duration**: Ongoing
**Success Criteria**: >99.9% uptime, <24h mean time to resolution

---

## Monitoring & Alerting

### Key Metrics to Monitor

#### API Performance
```
- Response time (p50, p95, p99)
  Target: p50 <500ms, p95 <1s, p99 <2s
  Alert: p99 >3s for 5 minutes

- Error rate (5xx, 4xx)
  Target: <0.5%
  Alert: >1% for 5 minutes

- Request throughput
  Target: Baseline + 20% headroom
  Alert: Sustained >baseline + 50%
```

#### Database Performance
```
- Query latency (p95)
  Target: <100ms
  Alert: >200ms for 10 minutes

- Connection pool utilization
  Target: <70% of max
  Alert: >90%

- Replication lag
  Target: <1s
  Alert: >5s
```

#### Infrastructure
```
- Vercel function duration
  Target: <3s average
  Alert: >5s for 10 minutes

- Memory usage (percent of allocation)
  Target: <70%
  Alert: >85%

- CPU usage
  Target: <60%
  Alert: >80%
```

#### Business Metrics
```
- PRs scored per day
  Baseline: Track historical
  Alert: 50% drop (may indicate webhook failure)

- Cron job execution success rate
  Target: >99.5%
  Alert: <99% for 3 consecutive runs

- Active users (DAU)
  Baseline: Week 1 metric
  Track: Daily trend
```

### Monitoring Setup

**Vercel Analytics** (automatic):
- Real User Monitoring (RUM)
- Serverless function duration
- Error rate tracking

**Supabase Monitoring**:
- Query performance
- Connection pool status
- Replication lag
- Database size

**Custom Dashboards**:
```bash
# Create in Datadog, New Relic, or Grafana
- API Health Dashboard
- Database Performance
- Business Metrics
- Incident Timeline
```

### Alert Thresholds

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| API High Latency | p99 >3s for 5m | Warning | Investigate, possible scale |
| High Error Rate | >1% for 5m | Critical | Immediate escalation |
| Database CPU | >80% for 10m | Warning | Scale database or optimize |
| Cron Job Failure | 3 consecutive failures | High | Check GitHub webhooks |
| Memory Pressure | >85% for 5m | Warning | Monitor, consider scaling |
| PII Data Exposure | Any detection | Critical | Immediate lockdown |

---

## On-Call Rotation

### On-Call Schedule

**Weekly Rotation** (Sunday-Sunday):
- 1 primary engineer (24/7 on-call)
- 1 secondary engineer (backup)
- Escalation path: Primary → Secondary → Manager → CTO

**Hours**:
- Weekday on-call: 9 AM - 6 PM (business hours)
- Weekend on-call: 24/7 (if applicable)
- Night on-call: 6 PM - 9 AM (if applicable)

**Compensation**:
- On-call stipend: $X per week
- Incident response: $Y per hour (minimum 2 hours)
- Incident on-site (if needed): Double time

### On-Call Responsibilities

**Before Incident**:
- Review runbooks (weekly)
- Test alert tools (verify Slack/PagerDuty working)
- Ensure access to all systems (Vercel, Supabase, GitHub)
- Know escalation contacts

**During Incident**:
- Acknowledge alert within 5 minutes
- Assess severity and impact
- Communicate status every 15 minutes
- Escalate if needed (>30 min without resolution)
- Document actions in incident log

**After Incident**:
- Post-mortem within 24 hours
- Root cause analysis
- Action items for prevention
- Update runbooks

### Runbooks

**High Latency (p99 >3s)**
```markdown
## Symptoms
- Alert: API High Latency
- Users report slow dashboard loads

## Diagnosis
1. Check Vercel Analytics for slow endpoints
2. Identify which routes are slow
3. Check database query times
4. Check Supabase query logs

## Actions
1. Scale Vercel (increase memory allocation)
2. Optimize slow queries (add indexes)
3. Enable query caching if applicable
4. Roll back recent deployments if applicable

## Escalation
If >5 minutes without improvement: Page secondary engineer
```

**High Error Rate (>1%)**
```markdown
## Symptoms
- Alert: High Error Rate
- Users report 500 errors

## Diagnosis
1. Check Vercel function logs for errors
2. Check database connection errors
3. Check rate limit violations
4. Check external API failures (Anthropic)

## Actions
1. Check recent deployments for issues
2. Verify database connectivity
3. Check API rate limits
4. Restart functions if hung (careful!)

## Escalation
If database down: Immediate escalation to Supabase support
```

**Cron Job Failure (3 consecutive failures)**
```markdown
## Symptoms
- Alert: Cron Job Failed
- GitHub webhook polling not running

## Diagnosis
1. Check Vercel Cron Jobs tab for logs
2. Verify CRON_SECRET is valid
3. Check GitHub App still installed
4. Verify database connectivity

## Actions
1. Manually trigger: curl -X POST https://app/api/cron/poll-github
2. Monitor 5-minute execution
3. Check webhook queue for backlog
4. Verify GitHub App permissions

## Escalation
If >10 failures: GitHub App may be revoked, check installation
```

**Database Connectivity Loss**
```markdown
## Symptoms
- All database queries failing
- Connection pool exhausted
- Users can't sign in or load data

## Diagnosis
1. Check Supabase status page
2. Verify network connectivity
3. Check connection pool status
4. Verify credentials still valid

## Actions
1. Verify Supabase status: https://status.supabase.com
2. Check connection string in Vercel secrets
3. Try manual connection from local: psql $DATABASE_URL
4. Restart Vercel functions to clear pool

## Escalation
If Supabase down: Contact Supabase support immediately
If connection issue: Contact Vercel support
```

---

## Incident Response Process

### Incident Severity Levels

**Critical (P1)**
- Complete service outage
- Data loss or corruption
- Security breach
- SLA violation
- Response: Page all engineers immediately

**High (P2)**
- Major feature unavailable
- Performance severely degraded
- Partial data loss
- Response: Page on-call engineer + manager

**Medium (P3)**
- Single feature degraded
- Performance issue (fixable)
- Minor bugs
- Response: On-call engineer

**Low (P4)**
- Cosmetic issues
- Workaround available
- Feature request
- Response: Create ticket, schedule fix

### Response Timeline

| Time | Action |
|------|--------|
| T+0 | Alert triggers, on-call acknowledges |
| T+5 | Initial assessment, severity declared |
| T+10 | Status posted to #incidents Slack channel |
| T+15 | Diagnosis underway, status update |
| T+30 | Escalation if no progress |
| T+60 | Executive notification if P1 |
| T+120 | Post-mortem scheduled |

### Communication During Incident

**Internal**:
- #incidents Slack channel (status updates every 15 min)
- PagerDuty (if using)
- Direct calls if critical

**External**:
- Status page update (status.dr-codium.com)
- Email notification to affected users
- Twitter/social media if widespread

---

## Common Incidents & Resolutions

### Incident: "PRs Not Being Scored"

**Detection Time**: 30 minutes after launch (from alert: 0 PRs/hour)

**Root Cause**: GitHub webhook secret mismatch

**Resolution**:
1. Check Vercel webhook route logs
2. Verify GitHub webhook signature validation
3. Check webhook secret in Vercel secrets vs GitHub App
4. Redeploy or rotate secret if mismatch
5. Test with manual webhook trigger
6. Verify PRs in queue start scoring

**Prevention**:
- Automated test: Send sample webhook daily
- Document secret rotation procedure
- Add monitoring for webhook failures

---

### Incident: "Database Connection Failures"

**Detection Time**: 5 minutes (immediate 500s)

**Root Cause**: Connection pool exhausted after 10k concurrent requests (DDoS)

**Resolution**:
1. Check Supabase connection pool status
2. Identify and block DDoS source if applicable
3. Increase connection pool size
4. Scale database if needed
5. Restart Vercel functions to clear stuck connections
6. Monitor recovery

**Prevention**:
- Rate limiting on API routes
- Connection pool monitoring with alerts
- Auto-scaling thresholds

---

### Incident: "Anthropic API Key Invalid"

**Detection Time**: 2 minutes (scoring starts failing)

**Root Cause**: API key rotated or revoked

**Resolution**:
1. Check Anthropic console for key status
2. Generate new API key
3. Update Vercel secrets
4. Redeploy or restart functions
5. Test scoring with sample PR
6. Monitor error rate returning to normal

**Prevention**:
- Set API key rotation reminders (quarterly)
- Monitor Anthropic API usage dashboard
- Have backup API key on file

---

## Incident Post-Mortem Template

**Incident**: [Title]
**Date**: [Date/Time]
**Duration**: [Start - End]
**Severity**: P1/P2/P3/P4

### Timeline
```
2026-07-20 09:15 - Alert triggered (high latency)
2026-07-20 09:18 - On-call acknowledged
2026-07-20 09:25 - Root cause identified (missing index)
2026-07-20 09:45 - Index created, performance restored
2026-07-20 10:00 - All clear, monitoring
```

### Root Cause
Brief summary of why incident occurred.

### Impact
- Duration: X minutes
- Users affected: Y
- PRs affected: Z
- Data loss: None/[specify]

### Resolution
Steps taken to fix the issue.

### Prevention
Changes to prevent recurrence:
- [ ] Add monitoring alert for condition X
- [ ] Add index on column Y
- [ ] Update runbook Z
- [ ] Training for team on [topic]

### Action Items
1. [Task] - Owner: [Name] - Due: [Date]
2. [Task] - Owner: [Name] - Due: [Date]

---

## Customer Success & Support

### Support Tier Response Times

| Channel | Severity | Target |
|---------|----------|--------|
| Email | P1 | 1 hour |
| Email | P2 | 4 hours |
| Email | P3 | 24 hours |
| In-App Chat | P1 | 30 min |
| In-App Chat | P2 | 2 hours |

### Common Support Issues

**"Why is my PR score low?"**
- Response: Explain scoring dimensions, offer Coach Panel for questions
- Resolution: User understands score calculation

**"How do I invite my team?"**
- Response: Link to docs, step-by-step in help center
- Resolution: Team invited successfully

**"GitHub integration not working"**
- Response: Verify GitHub App installed, webhook configured
- Resolution: Link GitHub repo and confirm first PR scored

**"Can I customize scoring?"**
- Response: Currently fixed algorithm, custom scoring on roadmap
- Resolution: Set expectations for future features

### Customer Success Check-ins

**Week 1 Post-Signup**:
- Email: "How's Dr. Codium working?"
- Goal: Onboard successfully, answer questions
- Action: If stuck, offer 1:1 call

**Month 1**:
- Email: "Share your team's progress"
- Goal: Celebrate wins, drive engagement
- Action: Collect testimonials, identify power users

**Quarterly**:
- Business review call for enterprise customers
- Goal: Assess satisfaction, gather feedback
- Action: Feature requests, renewal discussion

---

## Metrics Dashboard

### Daily Standup Metrics

Run daily 9:00 AM standup with these metrics:

```
Yesterday's Metrics:
- Signups: X (target: Y)
- Daily Active Users: X (trend: ↑/↓/→)
- PRs Scored: X (health: green/yellow/red)
- Error Rate: X% (target: <0.5%)
- Uptime: X% (target: >99.9%)
- Cron Job Success: X% (target: >99.5%)

Issues:
- [List any incidents or alerts]

Actions:
- [List any follow-up items]
```

### Weekly Metrics Review

**Monday 10:00 AM**:

```
Week-over-Week:
- Signups: X → Y (↑Z%)
- Weekly Active Users: X (↑Z%)
- Total PRs Scored: X (↑Z%)
- Customer Churn: X%
- NPS Score: X (if surveyed)

Top Issues:
1. [Issue] - Status: [Open/In Progress/Fixed]
2. [Issue]
3. [Issue]

Wins:
- [Celebration of user growth or positive feedback]
```

---

## Disaster Recovery

### Backup & Recovery Procedures

**Database Backups**:
- Automated: Daily backups via Supabase
- Point-in-time recovery: Up to 30 days
- Test restore: Monthly (first Friday)

**Manual Backup** (if needed):
```sql
-- Export all data
pg_dump $DATABASE_URL > backup_$(date +%s).sql

-- Test restore to staging
pg_restore staging_database < backup_$(date +%s).sql
```

### Data Recovery Scenarios

**Scenario 1: Accidental Data Deletion**
- Time to detect: <5 minutes (alert on DELETE volume)
- Recovery: Restore from backup (point-in-time)
- Time to recover: <30 minutes

**Scenario 2: Ransomware/Malicious Access**
- Time to detect: <1 hour (unusual activity alert)
- Recovery: Rotate all credentials, restore from backup
- Time to recover: 1-4 hours
- Communication: Customer notification required

**Scenario 3: Vercel Region Failure**
- Automatic: Vercel handles regional failover
- Manual: Deploy to alternative region if needed
- DNS: Vercel auto-updates
- Time to recover: <1 minute

---

## Scaling & Capacity Planning

### Current Capacity

**Vercel Serverless**:
- Memory: 1024 MB per function
- Timeout: 60 seconds
- Concurrency: Unlimited (auto-scales)
- Cost: $0.50 per 1M requests

**Supabase Database**:
- Connections: 10-20 (pooling mode)
- Row storage: Free tier up to 500K rows
- Compute: Auto-scales (monitoring included)

### Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Daily signups | >1000/day | Scale DB compute |
| Database CPU | >80% | Scale DB or optimize |
| Vercel invocations | >10M/month | Optimize or upgrade plan |
| Storage | >70% of quota | Clean old data or upgrade |

### Pre-Scaling Checklist

Before scaling, verify:
- [ ] All monitoring in place
- [ ] Runbooks updated for new capacity
- [ ] Testing in staging environment
- [ ] Team notified and on-call
- [ ] Rollback plan if issues
- [ ] Communication plan if user-facing changes

---

## Runbook Maintenance

### Weekly Runbook Review
- [ ] Check if any recent incidents occurred
- [ ] Update runbooks based on incident findings
- [ ] Remove outdated procedures
- [ ] Test key runbooks in staging

### Runbook Template
```markdown
# [Issue Name]

## Symptoms
- [Alert condition]
- [User-visible symptoms]

## Diagnosis
1. [Step 1 to investigate]
2. [Step 2]
3. [Step 3]

## Actions
1. [Action 1 - what to do]
2. [Action 2]
3. [Verification step]

## Escalation
- When to escalate
- Who to page
- Communication channel
```

---

## Resources

- **Incident Tracking**: GitHub Issues with `incident` label
- **Runbooks**: Shared wiki or Google Docs
- **On-Call**: PagerDuty or Slack (depending on setup)
- **Monitoring**: Vercel Analytics + Supabase Monitoring
- **Status Page**: status.dr-codium.com
- **Communication**: #incidents channel (Slack)
- **Escalation**: [CTO], [Manager], [Engineer 2]

---

## Success Criteria

✅ **Launch Operations Healthy**:
- >99.9% uptime
- Mean time to resolution (MTTR) <1 hour
- <5 critical incidents per month
- <24 hour MTBF (mean time between failures)

⚠️ **Needs Attention**:
- 99.5-99.9% uptime (near SLA)
- 1-2 hour MTTR
- 5-10 critical incidents per month
- 12-24 hour MTBF

❌ **Severe Issues**:
- <99.5% uptime (SLA breach)
- >2 hour MTTR
- >10 critical incidents per month
- <12 hour MTBF
