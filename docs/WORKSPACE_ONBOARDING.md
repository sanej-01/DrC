# Workspace Onboarding — Phase 2.4

Complete guide to setting up a workspace and linking repositories.

---

## Flow Overview

1. **Manager creates workspace** (admin endpoint)
2. **Manager links repositories** (selects repos from GitHub)
3. **Backfill is enqueued** (system fetches last 90 days of PRs)
4. **Developers are invited** (Phase 2.5)

---

## Phase 2.4: Repository Linking

### Prerequisites

- Manager account created and authenticated
- Manager has admin or manager role in workspace
- Manager has linked GitHub OAuth account (Phase 2.3)
- GitHub repositories exist and are accessible

### Step 1: Create Workspace (Admin)

**Endpoint:** `POST /api/admin/workspace`

**Authentication:** Admin role required

**Request:**
```json
{
  "name": "Platform Squad",
  "slug": "platform-squad"
}
```

**Response:**
```json
{
  "workspace": {
    "id": "uuid",
    "name": "Platform Squad",
    "slug": "platform-squad",
    "created_at": "2026-07-08T..."
  }
}
```

### Step 2: Link Repositories (Manager)

**Endpoint:** `POST /api/manager/workspace/repos/link`

**Authentication:** Manager role required, scoped to workspace

**Request:**
```json
{
  "workspace_id": "uuid",
  "repos": [
    {
      "owner": "my-org",
      "name": "backend",
      "repo_id": 12345,
      "is_private": false
    },
    {
      "owner": "my-org",
      "name": "frontend",
      "repo_id": 12346,
      "is_private": false
    },
    {
      "owner": "my-org",
      "name": "infra",
      "repo_id": 12347,
      "is_private": true
    }
  ]
}
```

**Response:**
```json
{
  "status": "linked",
  "repos": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "github_repo_id": 12345,
      "owner": "my-org",
      "name": "backend",
      "full_name": "my-org/backend",
      "url": "https://github.com/my-org/backend",
      "is_private": false
    },
    // ... more repos
  ],
  "backfill_enqueued": true
}
```

**What happens:**
- TC-ING-004: Repos are linked to workspace
- Backfill job is enqueued for each repo
- Backfill will fetch last 90 days of merged PRs

---

## Backfill Process

### How Backfill Works

1. Manager links repositories
2. System creates backfill job entries (status: `pending`)
3. Scheduled job or poller picks up pending backfill jobs
4. Uses developer's GitHub OAuth token to fetch PRs
5. Stores PR metadata (no diffs — TC-SCR-010)
6. Marks backfill job as `completed`

### Backfill Job States

```
pending → in_progress → completed
              ↓
            failed (with error_message)
```

### Fetching Backfill Status

**Endpoint:** `GET /api/manager/workspace/backfill?workspace_id=UUID`

**Response:**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "repo_id": "uuid",
      "status": "completed",
      "trigger": "manual",
      "fetched_count": 15,
      "enqueued_count": 15,
      "completed_at": "2026-07-08T..."
    },
    // ... more jobs
  ]
}
```

---

## Database Schema

### `repos` table
- Stores GitHub repository metadata
- Linked to workspace via `workspace_id`
- Unique constraint: `full_name` (owner/repo)

### `backfill_jobs` table
- Tracks backfill job status
- Has optional `repo_id` (repo backfill) or `user_id` (dev backfill)
- Indexed for fast polling: `workspace_id`, `status`

### Pull Requests Ingestion

During backfill:
1. Fetch PRs via GitHub API (using dev's OAuth token)
2. Extract metadata: title, additions, deletions, files_changed
3. **NO diff stored** — TC-SCR-010
4. Upsert into `pull_requests` table
5. Dedup by `pr_node_id`

---

## Security Considerations

### Token Usage
- Backfill uses **developer's GitHub OAuth token** (Phase 2.3)
- Token is scoped to `repo` + `read:user` permissions
- Token is **never logged** or sent to LLM
- Token is stored encrypted in `github_oauth_tokens` table

### Repository Access
- System can only see PRs that the developer can see on GitHub
- Private repos require GitHub OAuth token with `repo` scope
- Access is checked via GitHub API (not by us)

### Audit Logging
- Backfill job creation logged: `backfill_triggered`
- Backfill completion logged: `backfill_completed`
- Failed backfill logged: `backfill_failed`

---

## Handling Large Repositories

For repos with many merged PRs:

- Backfill is paginated (100 PRs per page)
- If backfill exceeds 10k PRs, warning is logged
- Only last 90 days are fetched (configurable)

---

## Common Issues & Troubleshooting

**Q: Backfill started but never completes**
- A: Check `backfill_jobs` table for status
  ```sql
  SELECT * FROM backfill_jobs WHERE status = 'in_progress';
  ```
- If stuck, manually update:
  ```sql
  UPDATE backfill_jobs SET status = 'failed', error_message = 'manual reset' WHERE id = '...';
  ```

**Q: Manager doesn't see option to link repos**
- A: Verify manager role in workspace: `SELECT * FROM memberships WHERE workspace_id = '...' AND user_id = '...';`

**Q: GitHub API rate limit exceeded**
- A: Backfill pauses and retries in 5 minutes
- Use managed backoff logic in scheduled job

**Q: Backfill includes draft PRs**
- A: By design — drafts are fetched but skipped during scoring (TC-ING-007)

---

## Next Steps

- Phase 2.5: Developer invite (invite link, developer joins, dev backfill triggered)
- Phase 3: Ingestion (webhook + poller for real-time PR events)
- Phase 4: Scoring (LLM scoring of enqueued PRs)
