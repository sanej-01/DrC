# GitHub OAuth Setup — Phase 2.3

Complete guide to setting up GitHub OAuth for user authentication and per-user repo access.

**IMPORTANT:** This is DISTINCT from the GitHub App webhook (Phase 3.1). You need TWO separate GitHub applications:
1. **GitHub OAuth App** (this guide) — for user authentication, scoped token storage
2. **GitHub App** (see GITHUB_APP_SETUP.md) — for webhook notifications, machine account

---

## Prerequisites

- GitHub account with permissions to create OAuth apps
- Dr. Codium app already deployed (or local dev environment)
- Environment variables from Phase 0.2 (Supabase, etc.)

---

## Step 1: Register GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
   - https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the form:

   **Application name:** `Dr Codium OAuth` (or your variant)

   **Homepage URL:** `https://your-app.vercel.app` (or `http://localhost:3000` for local dev)

   **Authorization callback URL:** `https://your-app.vercel.app/api/auth/github/callback`
   - For local dev: `http://localhost:3000/api/auth/github/callback`

4. Click "Register application"

## Step 2: Get Credentials

On your OAuth app settings page:

1. Copy the **Client ID**
   - Store in `GITHUB_OAUTH_CLIENT_ID` env var

2. Click "Generate a new client secret"
   - Copy the **Client Secret** (only shown once)
   - Store in `GITHUB_OAUTH_CLIENT_SECRET` env var

## Step 3: Configure Environment Variables

In `.env.local`:

```env
# GitHub OAuth (Phase 2.3)
GITHUB_OAUTH_CLIENT_ID=<your-client-id>
GITHUB_OAUTH_CLIENT_SECRET=<your-client-secret>
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
```

For production (Vercel):

```env
GITHUB_OAUTH_CLIENT_ID=<your-client-id>
GITHUB_OAUTH_CLIENT_SECRET=<your-client-secret>
GITHUB_OAUTH_REDIRECT_URI=https://your-app.vercel.app/api/auth/github/callback
```

**CRITICAL:** Never commit `.env.local` to git.

## Step 4: OAuth Flow

The flow works as follows:

1. User clicks "Connect GitHub" on settings page
2. Frontend calls `POST /api/auth/github/start`
3. Server generates CSRF state token, returns OAuth URL
4. Frontend redirects to `https://github.com/login/oauth/authorize?...`
5. User approves access on GitHub
6. GitHub redirects back to `/api/auth/github/callback?code=...&state=...`
7. Server exchanges code for access token
8. Server stores token in `github_oauth_tokens` table (encrypted at rest)
9. User is redirected back to app with `?github_linked=true`

## Step 5: Token Storage & Security

- Tokens are stored in the `github_oauth_tokens` table (created in Phase 2.3 migration)
- Table has RLS: each user can only access their own token
- Tokens are encrypted at rest by Supabase
- Tokens are NEVER logged or sent to LLM
- Tokens are used only for:
  - Backfilling PR data (Phase 2.4/2.5)
  - Checking repo access permissions
  - Revoking access when user disconnects

## Step 6: Scopes

Current OAuth scopes requested:

- `repo` — Full control of private/public repositories
- `read:user` — Read user profile information

These scopes are minimal and tied to the app's needs. Adjust in `lib/github-oauth.ts` if needed.

## Testing Locally

```bash
# 1. Start dev server
npm run dev

# 2. Go to http://localhost:3000/auth/sign-in

# 3. Click "Connect GitHub" (button added in Phase 2.3)

# 4. Authorize access on GitHub

# 5. Redirected back to app — check for "?github_linked=true"

# 6. Verify token stored:
#    SELECT * FROM github_oauth_tokens WHERE user_id = '<your-user-id>';
```

## Disconnecting

To disconnect/revoke GitHub access:

1. User clicks "Disconnect GitHub" in settings
2. Frontend calls `POST /api/auth/github/disconnect`
3. Server revokes token with GitHub
4. Server deletes token from database
5. Audit logged: `github_oauth_disconnected`

## Troubleshooting

**Invalid redirect_uri:**
- Make sure callback URL in `.env.local` matches exactly what's registered on GitHub
- For local dev, use `http://localhost:3000/api/auth/github/callback`
- For production, use your Vercel domain

**Token not being stored:**
- Check Supabase migration `20260708030000_github_oauth.sql` has run
- Verify `github_oauth_tokens` table exists: `SELECT * FROM github_oauth_tokens LIMIT 1;`
- Check auth user ID is being passed correctly to callback

**"Unauthorized" on disconnect:**
- Make sure JWT token is being sent in Authorization header
- Verify user is authenticated before disconnecting

**Revoke fails but continues:**
- This is intentional — if GitHub revoke fails, we still delete the local token
- User can re-link if needed

## Next Steps

- Phase 2.4: Workspace onboarding (manager selects repos, backfill triggered)
- Phase 2.5: Developer invite (invite link, 90-day backfill, duplicate guard)
- Phase 3: Ingestion (webhook + poller use OAuth token for GitHub API calls)
