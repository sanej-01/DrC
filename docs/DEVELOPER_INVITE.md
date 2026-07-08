# Developer Invite Flow — Phase 2.5

Complete guide to inviting developers to join a workspace.

---

## Flow Overview

1. **Manager creates invite link** (generates secure one-time token)
2. **Manager shares invite link** with developer (via email, Slack, etc.)
3. **Developer clicks invite link** (redirected to `/auth/invite?token=XXX`)
4. **Developer signs in** (if not already signed in)
5. **Developer accepts invite** (joins workspace, backfill triggered)
6. **Developer's 90-day PR backfill enqueued** (visible after scoring)

---

## Phase 2.5: Invite Creation & Acceptance

### Prerequisites

- Manager account created and authenticated
- Manager has manager+ role in workspace
- At least one repository linked (Phase 2.4)
- GitHub OAuth configured for backfill (Phase 2.3)

### Step 1: Manager Creates Invite Link

**Endpoint:** `POST /api/manager/workspace/invites/create`

**Authentication:** Manager role required, scoped to workspace

**Request:**
```json
{
  "workspace_id": "uuid",
  "email_pattern": "@company.com",
  "max_uses": 1,
  "expires_in_days": 30
}
```

**Response:**
```json
{
  "invite": {
    "id": "uuid",
    "token": "base64-encoded-token",
    "invite_url": "https://app.example.com/auth/invite?token=...",
    "email_pattern": "@company.com",
    "max_uses": 1,
    "expires_at": "2026-08-07T..."
  }
}
```

**Parameters:**
- `workspace_id` — Required
- `email_pattern` — Optional. Restrict invite to email domain (e.g., `@company.com`)
- `max_uses` — Default: 1. Can be > 1 for team invites
- `expires_in_days` — Default: 30. How long invite is valid

### Step 2: Manager Shares Invite Link

Manager can:
- Email the invite URL directly
- Post in Slack or other chat
- Print and distribute QR code
- Include in onboarding materials

**Invite URL format:**
```
https://app.example.com/auth/invite?token=T2FzaXR3amhqcWpxd2poYWpzcWpoYXE=
```

### Step 3: Developer Accepts Invite

1. Developer clicks invite link (redirected to `/auth/invite?token=...`)
2. System checks if developer is signed in
3. If not signed in, redirected to `/auth/sign-in?redirect_to=...`
4. Developer signs in (or signs up)
5. Developer accepts invitation
6. Developer is added to workspace as `developer` role
7. Developer's 90-day backfill is enqueued

**Endpoint:** `POST /api/auth/invites/accept`

**Authentication:** Authenticated user (JWT required)

**Request:**
```json
{
  "token": "base64-encoded-token"
}
```

**Response:**
```json
{
  "status": "joined",
  "workspace_id": "uuid",
  "membership_id": "uuid",
  "backfill": {
    "enqueued_count": 42,
    "error": null
  }
}
```

---

## Invite Token Security

### Token Format
- 32 bytes of cryptographically secure random data
- Base64-URL encoded (no padding)
- Example: `T2FzaXR3amhqcWpxd2poYWpzcWpoYXE=`

### Token Lifecycle
```
created → shared → used → deleted (after max_uses reached or expiry)
```

### Token Constraints
- **Single-use by default** (`max_uses: 1`)
- **Expires in 30 days** (configurable)
- **Email pattern optional** (restrict to domain)
- **No re-use after expiry** (auto-expires)

### Security Properties
- Tokens are URL-safe (can be sent in emails)
- Tokens have sufficient entropy (32 bytes = 256 bits)
- Tokens are not guessable (crypto.randomBytes)
- Tokens are not stored in plaintext in logs (only audit token hash)

---

## Backfill During Invite

When a developer accepts an invite:

1. Developer's GitHub OAuth token is retrieved
2. System queries all workspace repositories
3. System fetches all PRs authored by developer (last 90 days)
4. PRs are enqueued in `pull_requests` table
5. Deduplication by `pr_node_id` prevents duplicates
6. Backfill job is logged to audit_log

### Example Backfill Counts

If developer authored:
- 5 PRs in backend repo
- 3 PRs in frontend repo
- 2 PRs in docs repo

Then `backfill.enqueued_count = 10` (total unique PRs)

### Backfill Errors

If developer's GitHub token is not linked:
```json
{
  "status": "joined",
  "backfill": {
    "enqueued_count": 0,
    "error": "Developer GitHub account not linked"
  }
}
```

Developer can link GitHub account later via settings, and backfill can be manually triggered.

---

## Duplicate Protection

### Same Email
If developer is already in workspace:
- Response is `status: "already_member"`
- Invite token is still incremented
- Developer is not added twice (idempotent)

### Same GitHub Handle
If two people with same GitHub handle try to join:
- Both are added to workspace (different user records)
- Each has own backfill and scores
- Scores are isolated per-user in database

### Cross-Workspace
If developer is in multiple workspaces:
- Separate membership record for each workspace
- Each workspace has independent scores and data
- Backfill is per-workspace

---

## Manager Workflow

### Creating Multiple Invite Links

```bash
# Create 5 shareable invites (team onboarding)
curl -X POST /api/manager/workspace/invites/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "workspace_id": "uuid",
    "email_pattern": "@company.com",
    "max_uses": 5,
    "expires_in_days": 30
  }'

# Returns ONE invite token that works for up to 5 people
# Each use increments used_count
```

### Verifying Invite Status

```sql
-- Check pending invites
SELECT * FROM invite_tokens
WHERE workspace_id = 'uuid'
  AND used_count < max_uses
  AND expires_at > NOW();

-- Check used invites
SELECT * FROM invite_tokens
WHERE workspace_id = 'uuid'
  AND used_count >= max_uses;

-- Check expired invites
SELECT * FROM invite_tokens
WHERE workspace_id = 'uuid'
  AND expires_at <= NOW();
```

### Revoking Invite

To prevent further use of an invite:

```sql
UPDATE invite_tokens
SET used_count = max_uses
WHERE id = 'uuid';

-- OR delete entirely
DELETE FROM invite_tokens WHERE id = 'uuid';
```

---

## Troubleshooting

**Q: Developer clicks invite, sees "Invalid or expired invite"**
- A: Check invite_tokens table:
  ```sql
  SELECT * FROM invite_tokens WHERE token = 'XXX';
  ```
- Possible causes:
  - Token doesn't exist (typo in URL)
  - Invite expired (`expires_at < NOW()`)
  - Invite exhausted (`used_count >= max_uses`)

**Q: Developer joined but no backfill happened**
- A: Check GitHub OAuth token is linked
  ```sql
  SELECT * FROM github_oauth_tokens WHERE user_id = 'uuid';
  ```
- If missing, have developer link GitHub account in settings

**Q: Developer already in workspace, invite still works**
- A: This is by design (idempotent). Developer is not added twice:
  ```sql
  SELECT COUNT(*) FROM memberships
  WHERE workspace_id = 'uuid' AND user_id = 'uuid';
  -- Returns 1 (not 2)
  ```

**Q: Email pattern restriction not working**
- A: Verify developer's email matches pattern:
  ```sql
  SELECT email FROM users WHERE id = 'uuid';
  -- Must end with email_pattern
  ```

**Q: Backfill shows error "Developer GitHub account not linked"**
- A: Developer needs to link GitHub account (Phase 2.3):
  1. Go to Settings
  2. Click "Connect GitHub"
  3. Authorize access
  4. Manager can re-trigger backfill

---

## Next Steps

- Phase 3: Ingestion (webhook + poller for real-time PR events)
- Phase 4: Scoring (LLM scoring of enqueued PRs)
- Phase 5: Developer dashboard (growth ring, dimensions, coaching cards)
