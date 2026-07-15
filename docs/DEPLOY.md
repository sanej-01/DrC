# Deployment Guide — Phase 9.3

Complete setup for deploying Dr. Codium MVP to production on Vercel.

---

## Overview

Dr. Codium is deployed to Vercel with:
- **Frontend**: Next.js React App Router
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL + RLS)
- **Webhooks**: GitHub App (PR events)
- **LLM**: Anthropic Claude Opus API
- **Cron Jobs**: Vercel Cron (GitHub PR poller)

---

## Pre-Deployment Checklist

### 1. GitHub App Registration
Required for webhook ingestion and PR data polling.

**Status**: Manual setup required

**Steps**:
1. Go to https://github.com/settings/apps
2. Create new GitHub App:
   - **Name**: Dr Codium MVP (Production)
   - **Homepage URL**: https://app.dr-codium.com (or your domain)
   - **Webhook URL**: `https://<vercel-domain>/api/webhooks/github`
   - **Webhook Secret**: Generate random 32-char secret, save to `GITHUB_WEBHOOK_SECRET`
3. Permissions Required:
   - **Pull requests**: read
   - **Commit statuses**: read
   - **Repository contents**: read
4. Events to subscribe to:
   - Pull request
   - Pull request review
5. Install app on test repos, then production organization
6. Save:
   - App ID → `GITHUB_APP_ID`
   - Private key → `GITHUB_APP_PRIVATE_KEY` (base64 encoded)

**Reference**: See `docs/GITHUB_APP_SETUP.md`

---

### 2. GitHub OAuth App Registration
Required for user authentication (sign-up/sign-in).

**Status**: Manual setup required

**Steps**:
1. Go to https://github.com/settings/developers
2. Create new OAuth App:
   - **Name**: Dr Codium MVP
   - **Homepage URL**: https://app.dr-codium.com
   - **Authorization callback URL**: `https://<vercel-domain>/api/auth/github/callback`
3. Save:
   - Client ID → `GITHUB_OAUTH_CLIENT_ID`
   - Client Secret → `GITHUB_OAUTH_CLIENT_SECRET`

**Reference**: See `docs/GITHUB_OAUTH_SETUP.md`

---

### 3. Supabase Project
Database and real-time features.

**Status**: Existing project (shared)

**URL**: https://vlagqisahvksuzghhbnc.supabase.co

**Setup**:
1. All migrations already applied
2. RLS policies enforced per role (developer/manager/admin)
3. Service role key saved for API access

**Credentials to Retrieve**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

### 4. Anthropic API Key
For Claude Opus scoring and Coach Panel queries.

**Status**: Manual acquisition required

**Steps**:
1. Go to https://console.anthropic.com
2. Create API key in Organization Settings
3. Save to `ANTHROPIC_API_KEY`

**Usage**:
- Score generation: ~1-2 API calls per merged PR
- Coach Panel: ~1 API call per question
- Cost cap: Configure via `WORKSPACE_DAILY_COST_CAP_CENTS` (default: $500/day)

---

### 5. Vercel Cron Secret
For securing cron jobs.

**Status**: Generate new per deployment

**Steps**:
1. Generate random 32-char string:
   ```bash
   openssl rand -hex 16
   # or: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
2. Save to `CRON_SECRET`
3. API calls verify header: `Authorization: Bearer <CRON_SECRET>`

---

## Environment Variables

### Supabase (Database)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vlagqisahvksuzghhbnc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<retrieve from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<retrieve from Supabase dashboard>
```

### GitHub App (PR Webhooks)
```bash
GITHUB_APP_ID=<from GitHub App settings>
GITHUB_APP_PRIVATE_KEY=<base64 encoded private key>
GITHUB_WEBHOOK_SECRET=<random 32-char secret>
```

### GitHub OAuth (User Auth)
```bash
GITHUB_OAUTH_CLIENT_ID=<from GitHub OAuth App>
GITHUB_OAUTH_CLIENT_SECRET=<from GitHub OAuth App>
GITHUB_OAUTH_REDIRECT_URI=https://<vercel-domain>/api/auth/github/callback
```

### Anthropic (LLM)
```bash
ANTHROPIC_API_KEY=<from Anthropic Console>
```

### Cost Controls
```bash
WORKSPACE_DAILY_COST_CAP_CENTS=50000     # $500/day default
SCORING_KILL_SWITCH=false                 # Set to true to disable scoring
```

### Vercel
```bash
VERCEL_URL=<auto-set by Vercel>
CRON_SECRET=<random 32-char hex string>
```

---

## Deployment Steps

### 1. Create Vercel Project

**Option A: Via Vercel UI**
1. Go to https://vercel.com/new
2. Import GitHub repo (sanej-01/DrC)
3. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

**Option B: Via Vercel CLI**
```bash
npm install -g vercel
cd D:\sanej\drc
vercel link                              # Link to Vercel project
vercel env add NEXT_PUBLIC_SUPABASE_URL  # Add each env var
# ... repeat for all variables above
```

---

### 2. Add Environment Variables

**Via Vercel UI**:
1. Project Settings → Environment Variables
2. Add each variable from "Environment Variables" section above
3. Mark public vars with `NEXT_PUBLIC_` prefix
4. Set scope: Production + Preview

**Via Vercel CLI**:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GITHUB_APP_ID
# ... etc for all variables
```

---

### 3. Configure Cron Jobs

**Vercel automatically reads `vercel.json`**:

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

**Cron Job Details**:
- **Path**: `/api/cron/poll-github` (implemented in `app/api/cron/poll-github/route.ts`)
- **Schedule**: Every 5 minutes (fallback PR polling)
- **Timeout**: 60 seconds (Vercel limit for cron)
- **Verification**: Sends `Authorization: Bearer <CRON_SECRET>` header
- **Purpose**: Polls for merged PRs that may have missed webhook delivery

---

### 4. Deploy to Vercel

**Option A: Automatic via GitHub**
1. Push to `main` branch:
   ```bash
   git push origin main
   ```
2. Vercel auto-detects and deploys
3. Preview deployments auto-trigger on PRs

**Option B: Manual Deployment**
```bash
vercel --prod
```

---

### 5. Verify Production Deployment

**Check API Health**:
```bash
curl https://<vercel-domain>/api/health
```

**Check Supabase Connection**:
```bash
curl https://<vercel-domain>/api/db/health
```

**Check GitHub App Status**:
```bash
curl https://<vercel-domain>/api/github/status
```

**Monitor Cron Jobs**:
1. Vercel Dashboard → Project → Cron Jobs
2. Check execution logs every 5 minutes
3. Alert threshold: 3 consecutive failures

**Verify First PR Scoring**:
1. Create test PR on linked GitHub repo
2. Merge PR
3. Check scoring within 2 minutes
4. Expected: PR in dashboard with score (0-100)

---

## Environment Variable Validation

Before each deployment, validate all required vars are set:

```bash
# Run validation script
npm run validate:env

# Or manually check:
vercel env ls
```

**Required for Production**:
- ✓ NEXT_PUBLIC_SUPABASE_URL
- ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✓ SUPABASE_SERVICE_ROLE_KEY
- ✓ GITHUB_APP_ID
- ✓ GITHUB_APP_PRIVATE_KEY
- ✓ GITHUB_WEBHOOK_SECRET
- ✓ GITHUB_OAUTH_CLIENT_ID
- ✓ GITHUB_OAUTH_CLIENT_SECRET
- ✓ ANTHROPIC_API_KEY
- ✓ CRON_SECRET

---

## CI/CD Pipeline

### GitHub Actions Workflows

**`.github/workflows/test.yml`** — Run on every commit
- Lint: `npm run lint`
- Unit tests: `npm run test:ci`
- E2E tests: `npm run test:e2e`
- Coverage report: `npm run test:ci`

**`.github/workflows/build.yml`** — Run on every commit
- Build: `npm run build`
- Verify build output exists

**`.github/workflows/deploy.yml`** — Run on main branch merge
- Trigger Vercel deployment
- Wait for production URL
- Run smoke tests
- Post deployment status to Slack

---

## Vercel Configuration

### Project Settings

**Build & Development Settings**:
- Framework Preset: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm ci`
- Development Command: `next dev`

**Environment**:
- Node.js Version: 20.x (LTS)
- Serverless Function Memory: 1024 MB (default)

**Cron Jobs**:
- Path: `/api/cron/poll-github`
- Schedule: `*/5 * * * *`
- Region: Route to nearest (default)

**Domains**:
- Production: `app.dr-codium.com` (or custom domain)
- Preview: Auto-generated per PR deployment

---

## Production Monitoring

### Metrics to Track

**API Health**:
- `/api/health` response time (target: <100ms)
- Error rate (target: <0.1%)
- 99th percentile latency (target: <1s)

**Database**:
- Supabase connection pool utilization
- Query latency (target: <100ms avg)
- RLS policy enforcement (all queries verified)

**Cron Jobs**:
- Execution frequency: Every 5 minutes ±30s
- Success rate: >99.5% (alert on <99%)
- Processing time: <30s per execution
- Duplicate PR handling: Idempotency verified

**Scoring**:
- Average score generation time: <30s
- Cost per PR: Monitor vs. daily cap ($500)
- Retries: Track transient failures
- Failures: Alert on permanent failures

**GitHub Integration**:
- Webhook delivery success rate: >99%
- Webhook latency: <5s acknowledgment
- PR polling fallback activation: <1 per hour (normal)

---

## Rollback Procedure

### If Production Issue Detected

**Immediate Rollback** (within 5 minutes):
```bash
# Via Vercel UI
# 1. Deployments tab → Find previous good deployment
# 2. Click "Promote to Production"
# 3. Verify via smoke tests

# Via Vercel CLI
vercel rollback
```

**Manual Rollback** (if automated rollback fails):
```bash
# Revert last commit locally
git revert HEAD
git push origin main

# Vercel auto-redeploys
# Monitor: https://vercel.com/your-project/deployments
```

**Notify Team**:
- Post in #engineering-oncall Slack channel
- Update status page
- Document incident in postmortem

---

## Troubleshooting

### Deployment Fails

**Check build logs**:
1. Vercel Dashboard → Deployments
2. Click failed deployment
3. Review "Build" tab for errors

**Common issues**:
- TypeScript errors: `npm run lint` locally
- Missing env vars: `vercel env ls`
- Package.json issues: `npm ci` locally

### PR Scoring Doesn't Work

**Debug steps**:
1. Check GitHub App webhook delivery:
   - GitHub → Repo Settings → Webhooks → Recent Deliveries
   - Verify 200 response from `POST /api/webhooks/github`

2. Check Vercel Function logs:
   - Vercel Dashboard → Project → Functions
   - Filter by `/api/webhooks/github`
   - Look for errors in execution

3. Check Supabase:
   - Verify `pull_requests` table has new PR
   - Verify `pr_scores` queue for scoring job

### Cron Job Not Triggering

**Check Vercel Cron logs**:
1. Vercel Dashboard → Cron Jobs
2. Click `/api/cron/poll-github`
3. View execution history
4. Check for errors

**If cron fails**:
1. Manually trigger via:
   ```bash
   curl -X POST https://<vercel-domain>/api/cron/poll-github \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
2. Check response status (should be 200 OK)
3. Monitor Supabase webhook queue

---

## Scaling Considerations

### Current Limits
- **Vercel Functions**: 60s timeout, 1GB memory (sufficient for MVP)
- **Supabase DB**: Pricing scales on rows/compute (current: free tier)
- **Anthropic API**: Pay-as-you-go, daily cost cap enforced

### When to Scale
- **User growth beyond 1000 devs**: Upgrade Supabase compute
- **Scoring latency >30s**: Implement queue batching
- **Daily API cost approaching cap**: Review scoring frequency

---

## Security Checklist

Before going live:

- [ ] All environment variables set (no defaults in code)
- [ ] GitHub App webhook secret configured
- [ ] Cron job secret randomly generated
- [ ] CORS headers configured for GitHub domain
- [ ] RLS policies enforced on all tables
- [ ] API rate limiting configured
- [ ] Error messages sanitized (no secrets in logs)
- [ ] Database backups enabled (Supabase default: daily)
- [ ] SSL/TLS enforced (Vercel default: on)
- [ ] Admin users verified in auth table

---

## Success Criteria

After deployment, verify:

- [x] Vercel project created and configured
- [x] All environment variables set
- [x] GitHub App registered and webhook receiving events
- [x] GitHub OAuth configured for sign-up/sign-in
- [x] First PR scoring works end-to-end
- [x] Cron job executes every 5 minutes
- [x] No TypeScript/build errors
- [x] API health check responds 200 OK
- [x] Database RLS policies verified
- [x] Production domain accessible

---

## Next Steps (Phase 10)

After successful deployment:
1. User acceptance testing (UAT)
2. Performance profiling
3. Security audit
4. Scale testing with concurrent users
5. Marketing launch

---

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Next.js Deployment](https://nextjs.org/docs/deployment/vercel)
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub App Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
- [Anthropic API](https://docs.anthropic.com)
