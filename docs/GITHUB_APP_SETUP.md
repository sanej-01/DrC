# GitHub App Setup — Phase 3.1

Complete guide to registering and configuring the Dr. Codium GitHub App for PR ingestion.

## Prerequisites

- GitHub organization or personal account
- Admin access to register GitHub Apps
- Vercel project (or ngrok for local testing)

## Step 1: Register GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
   - https://github.com/settings/apps
2. Click "New GitHub App"
3. Fill in details:

   **App name:** `Dr Codium MVP` (or your variant)
   
   **Homepage URL:** `https://your-vercel-domain.vercel.app`
   
   **Webhook URL:** `https://your-vercel-domain.vercel.app/api/webhooks/github`
   
   **Webhook secret:** Generate a secure random string (≥32 chars)
   - Store in `GITHUB_WEBHOOK_SECRET` env var

4. **Repository permissions:**
   - Contents: `Read` (to fetch PR diffs)
   - Pull requests: `Read` (to list PRs)

5. **Events to subscribe to:**
   - ✅ `Pull request` (for merged PR notifications)

6. **Where can this app be installed?**
   - ✅ Only on this account (or ✅ Any account if you want others to use it)

7. Click "Create GitHub App"

## Step 2: Generate Private Key

1. In your GitHub App settings page, scroll to "Private keys"
2. Click "Generate a private key"
3. Save the `.pem` file securely

## Step 3: Configure Environment Variables

In `.env.local`:

```env
GITHUB_APP_ID=<your-app-id-from-step-1>
GITHUB_APP_PRIVATE_KEY=<contents-of-.pem-file>
GITHUB_WEBHOOK_SECRET=<webhook-secret-from-step-1>
```

**CRITICAL:** Never commit these to git. Use `.gitignore`:

```
.env.local
.env.*.local
*.pem
```

## Step 4: Install App on Your Repository

1. Go to your GitHub repository settings
2. Developer settings → GitHub Apps → Authorized apps
3. Install "Dr Codium MVP" on your repository
4. Select which repositories to give access to
5. Confirm

## Step 5: Test Webhook Delivery

1. Go to your GitHub App settings → Advanced
2. Scroll to "Recent deliveries"
3. You should see a test webhook from the app installation
4. Click on it to see the payload and response

## Webhook Flow (Phase 3)

**Trigger:** PR merged in a linked repository

**Flow:**
1. GitHub sends webhook POST to `/api/webhooks/github`
2. Server verifies HMAC signature (TC-ING-002)
3. Extract PR metadata (TC-ING-001)
4. Check for duplicate by `pr_node_id` (TC-ING-003)
5. Enqueue in `pull_requests` table (metadata only, no diff)
6. Respond 200 immediately (fast)
7. Later: Poller fetches diff, scores, and stores results

**Security:**
- ✅ Webhook signature verified (HMAC-SHA256)
- ✅ Only merged PRs processed
- ✅ Dedup by `pr_node_id` (prevents double-scoring)
- ✅ No raw diffs stored (TC-SCR-010)
- ✅ All access logged to audit_log (TC-AUTH-005)

## Local Testing (with ngrok)

For local development without Vercel:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Create ngrok tunnel
ngrok http 3000

# Terminal 3: Update GitHub App
# Go to GitHub App settings → Webhook URL
# Change to: https://your-ngrok-url.ngrok.io/api/webhooks/github
```

Then create/merge a PR in your test repo to trigger the webhook.

## Debugging

**Check webhook deliveries:**
- GitHub App settings → Advanced → Recent deliveries
- Click a delivery to see request/response

**Check database:**
```sql
SELECT * FROM pull_requests ORDER BY created_at DESC LIMIT 10;
SELECT * FROM audit_log WHERE action LIKE 'webhook%' ORDER BY created_at DESC;
```

**Check logs:**
```bash
npm run dev  # Look for console.error() output
vercel logs  # For production
```

## Next Steps

- Phase 3.2: Webhook receiver (✅ done in this phase)
- Phase 3.3: HMAC verification (✅ done)
- Phase 3.4: Enqueue + dedup (✅ done)
- Phase 3.5: Poller fallback
- Phase 3.6: Guards (empty diff, drafts, large PRs)
- Phase 3.7: Secret redaction
- Phase 4: Scoring
