# Production Deployment Checklist — Phase 9.3

Pre-launch verification tasks for Dr. Codium MVP.

---

## Pre-Deployment (48 hours before launch)

### GitHub Integration Setup
- [ ] GitHub App registered and installed on organization
  - App ID documented: `_________________`
  - Webhook secret stored in Vercel secrets
  - Webhook URL: `https://<vercel-domain>/api/webhooks/github`

- [ ] GitHub OAuth App created
  - Client ID documented: `_________________`
  - Client secret stored in Vercel secrets
  - Redirect URI: `https://<vercel-domain>/api/auth/github/callback`

### Environment Variables
- [ ] All required variables set in Vercel project settings
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GITHUB_APP_ID`
  - `GITHUB_APP_PRIVATE_KEY`
  - `GITHUB_WEBHOOK_SECRET`
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `ANTHROPIC_API_KEY`
  - `CRON_SECRET`

- [ ] Validation script passes
  ```bash
  npx ts-node scripts/validate-env.ts
  # Output: ✅ All validations passed
  ```

### Vercel Project Configuration
- [ ] Vercel project linked to GitHub repo (sanej-01/DrC)
- [ ] Build command: `npm run build` ✓
- [ ] Output directory: `.next` ✓
- [ ] Environment: Node.js 20.x ✓
- [ ] Cron job configured:
  - Path: `/api/cron/poll-github`
  - Schedule: `*/5 * * * *`
- [ ] Domain configured (e.g., `app.dr-codium.com`)
- [ ] SSL certificate active

### Supabase Database
- [ ] All migrations applied
  - Run: `supabase db push` (local) or verify via Supabase console
  - Check: All 20+ tables present
    - `workspaces`, `workspace_members`, `users`
    - `pull_requests`, `pr_scores`, `pr_aggregates`
    - `coaching_cards`, `feedback_votes`
    - `alerts`, `alerts_actions_log`
    - `manager_notes`, `coach_questions`, `disputes`
    - `audit_log`, `webhook_queue`

- [ ] RLS policies enforced
  - Run: `SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'POLICY'`
  - Check: All public tables have RLS enabled

- [ ] Indexes created for performance
  - Check: `created_at`, `workspace_id`, `user_id` indexed on main tables
  - Check: Composite indexes on `(workspace_id, developer_id)` for multi-tenant isolation

- [ ] Backups enabled (Vercel default: daily)

### Security Audit
- [ ] No hardcoded secrets in code
  - Run: `git log --grep="secret\|password\|key" -i` (should be empty)
  - Run: `grep -r "test123\|password" app/` (should be empty)

- [ ] Environment variables not logged
  - Check: API routes don't console.log env vars
  - Check: Error messages sanitized

- [ ] CORS headers configured correctly
  - GitHub domain allowed
  - Frontend domain allowed
  - API routes don't expose sensitive headers

- [ ] Rate limiting configured
  - API route guards check request rate
  - Vercel rate limiting enabled

- [ ] API authentication verified
  - Cron routes check `Authorization: Bearer <CRON_SECRET>`
  - Webhook routes check GitHub signature

### Build & Testing
- [ ] Full test suite passes
  ```bash
  npm run test:all
  # Output: All tests passing
  ```

- [ ] TypeScript strict mode
  ```bash
  npm run lint
  # Output: No errors
  ```

- [ ] No TypeScript warnings
  ```bash
  npm run build 2>&1 | grep -i "warn" || echo "No warnings"
  ```

- [ ] E2E tests pass locally
  ```bash
  npm run test:e2e
  # Output: 27 tests passing
  ```

- [ ] Accessibility tests pass
  ```bash
  npx playwright test tests/accessibility.test.ts
  # Output: 25 tests passing
  ```

---

## Day-of-Launch (Deployment Day)

### Pre-Deployment Verification (1 hour before)
- [ ] Latest main branch built successfully
  - Check Vercel Deployments tab
  - Status: ✓ Ready

- [ ] All team members notified
  - #engineering-oncall pinned
  - On-call engineer identified for rollback duty

- [ ] Slack channels ready
  - #engineering-oncall available
  - #status-page ready for updates

### Deployment
- [ ] Deploy command executed
  ```bash
  git push origin main
  # or: vercel --prod
  ```

- [ ] Vercel deployment in progress
  - Monitor: https://vercel.com/your-project/deployments
  - Wait for: "Production" badge

- [ ] Health checks passing
  ```bash
  curl https://app.dr-codium.com/api/health
  # Output: HTTP 200 OK
  ```

### Post-Deployment Verification (first 30 minutes)
- [ ] API responding
  ```bash
  curl https://app.dr-codium.com/api/health
  # Expected: {"status":"ok"}
  ```

- [ ] Database connected
  ```bash
  curl https://app.dr-codium.com/api/db/health
  # Expected: {"status":"connected"}
  ```

- [ ] GitHub integration active
  - Trigger test PR on demo repo
  - Verify webhook received in GitHub App settings
  - Check Supabase `webhook_queue` table for entry

- [ ] Cron job executing
  - Wait 5 minutes for next execution
  - Check Vercel Cron Jobs tab
  - Expected: "Last Run" timestamp within last 5 minutes

- [ ] Sign-up flow working
  - Navigate to: https://app.dr-codium.com/auth/sign-up
  - Create test account
  - Verify GitHub OAuth redirect works
  - Check `users` table for new entry

- [ ] Dashboard accessible
  - Login with test account
  - Navigate to: https://app.dr-codium.com/app/dashboard
  - Expected: Dashboard loads without errors

### Production Monitoring (first 2 hours)
- [ ] Error rate normal (<0.1%)
  - Check: Vercel Analytics
  - Check: Sentry/Rollbar if configured

- [ ] Response times normal (<1s p99)
  - Check: Vercel Analytics
  - Check: Cloudflare if applicable

- [ ] Database performance normal
  - Check: Supabase Dashboard → Monitoring
  - Query latency: <100ms avg

- [ ] GitHub webhook delivery working
  - Create PR on demo repo
  - Merge PR
  - Verify in dashboard within 2 minutes
  - Expected: PR score 0-100

- [ ] Coaching cards generating
  - Merged PR should have coaching cards
  - Expected: 3-5 cards per PR

- [ ] No log errors
  - Check: Vercel Function logs
  - Filter by "error" or "500"
  - Expected: None found

---

## Post-Launch (Next 24 Hours)

### Monitoring
- [ ] Cron job running consistently
  - Monitor: Every 5 minutes ±30 seconds
  - Failures: 0 (or alert if >3 consecutive)

- [ ] PR scoring end-to-end working
  - Test: Create and merge PR
  - Timeline: Webhook received → Enqueued → Scored → Visible
  - Expected: All steps <60s total

- [ ] Multiple user roles tested
  - Developer: Can view own dashboard
  - Manager: Can view team garden and drill-down
  - Admin: Can view VP dashboard

- [ ] Email/notifications working
  - If configured: Alert email sent for score drop
  - If configured: Slack notification for new feedback

### Incident Preparedness
- [ ] Rollback procedure tested
  - Previous deployment identified
  - Rollback command ready: `vercel rollback`
  - On-call engineer briefed

- [ ] Escalation chain established
  - Engineering lead: `_________________`
  - DevOps lead: `_________________`
  - Slack #incident-commander available

- [ ] Status page updated
  - Status: "All Systems Operational"
  - Deployment notes: Version X.Y.Z live

### User Onboarding
- [ ] Beta users notified
  - Email sent with sign-up link
  - Instructions included

- [ ] First team workspace created
  - Admin user provisioned
  - Sample GitHub repo linked
  - Demo data loaded (if applicable)

---

## Post-Launch Review (End of Day)

### Metrics
- [ ] User signups: __________ (target: >5)
- [ ] PRs ingested: __________ (target: >10)
- [ ] Successful scores: __________ (target: >80%)
- [ ] API error rate: _________% (target: <0.1%)
- [ ] Cron job execution success rate: _________% (target: >99%)

### Issues Found
- [ ] No critical issues (if any, documented below)
- [ ] No data corruption (audit log verified)
- [ ] No security incidents (no unauthorized access logs)

**Issues summary** (if any):
```
Issue 1: _______________
Resolution: _______________
Status: [Fixed / Monitoring / Escalated]

Issue 2: _______________
Resolution: _______________
Status: [Fixed / Monitoring / Escalated]
```

### Lessons Learned
- [ ] Quick retro conducted
- [ ] Action items documented
- [ ] Incident timeline recorded

---

## Sign-Off

Production deployment approved by:

- **DevOps Lead**: _________________ Date: _________
- **Tech Lead**: _________________ Date: _________
- **Product Lead**: _________________ Date: _________

---

## Rollback Decision Criteria

**Rollback IMMEDIATELY if**:
- ❌ API returning 500 errors (>10% of requests)
- ❌ Database connection lost
- ❌ GitHub webhooks not being received
- ❌ Cron jobs completely failing (3+ consecutive failures)
- ❌ Security breach detected
- ❌ Data corruption in critical tables

**Rollback AFTER 5 MINUTES if**:
- ⚠️ Score generation completely broken (0% success)
- ⚠️ Sign-up flow broken
- ⚠️ Multiple core features offline

**Monitor and Fix if**:
- ✓ Minor UI issues
- ✓ Slow API responses (but working)
- ✓ Occasional errors (<1%)

---

## Resources

- Vercel Dashboard: https://vercel.com/your-project
- Supabase Dashboard: https://app.supabase.com
- GitHub App Settings: https://github.com/settings/apps
- Status Page: https://status.dr-codium.com (if configured)
- Incident Channel: #engineering-oncall (Slack)

---

## Emergency Contacts

- **On-Call Engineer**: _________________ Phone: _________
- **CTO**: _________________ Phone: _________
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
