# Row-Level Security (RLS) Policies

Complete RLS implementation for Dr. Codium MVP. Every table is protected with policies that enforce:

✅ **Privacy by default** — Developers see only their own data  
✅ **Team boundaries** — Managers see only their team  
✅ **Cross-tenant isolation** — Different workspaces are completely separate  
✅ **Anti-surveillance** — Manager notes never visible to developers  

## Policy Model

### Role-Based Access

**Developer**
- See own PRs and scores
- See own coaching cards
- See own disputes
- Can dispute own PRs
- See feedback on their PRs

**Manager**
- See team members' data
- See team PRs and scores
- See team coaching cards
- Review disputes
- Create/view private notes about team (never visible to devs)
- See team alerts

**Admin**
- See all data in workspace
- Manage members and repos
- Configure workspace settings

**Service Role** (system/scoring)
- Insert PRs, scores, feedback
- Create audit entries
- Generate alerts
- (Only used server-side; never exposed to client)

## Table Policies

### `workspaces`
- **SELECT:** Users in workspace only
- **INSERT/UPDATE/DELETE:** Admins only

### `users`
- **SELECT:** Self + team members if manager/admin
- **UPDATE:** Self only

### `memberships`
- **SELECT:** Self + team members if manager/admin
- **INSERT/UPDATE:** Admins only

### `repos`
- **SELECT:** Team members in workspace
- **INSERT/UPDATE:** Admins only

### `pull_requests`
- **SELECT:** Team members in workspace
- **INSERT:** Admins (or service_role)

### `pr_scores`
- **SELECT:** Team members in workspace
- **INSERT:** Admins (or service_role)

### `feedback_items`
- **SELECT:** Team members in workspace
- **INSERT:** System (via scoring service)

### `coaching_cards`
- **SELECT:** Self (dev) + team if manager/admin
- **INSERT/UPDATE:** System only

### `disputes`
- **SELECT:** Self (dev on own PR) + managers/admins in workspace
- **INSERT:** Dev only (on own PR)
- **UPDATE:** Managers/admins only (for accept/reject)

### `notes` — **ANTI-SURVEILLANCE**
- **SELECT:** Author only + admins (NOT about_user_id!)
- **INSERT:** Managers/admins only
- **UPDATE:** Author + admins
- **DELETE:** Author + admins
- **Critical:** Developer never sees notes ABOUT them

### `alerts`
- **SELECT:** for_user_id + admins
- **INSERT:** System only

### `audit_log`
- **SELECT:** Managers/admins only
- **INSERT:** System only

### `feedback_helpfulness`
- **SELECT:** Same as feedback (team members)
- **INSERT/UPDATE:** User only (own votes)

## Security Guarantees

### Cross-Tenant Isolation (NFR-2)
- A user authenticated to workspace A cannot access workspace B's data
- RLS silently filters (returns empty) rather than throwing 403
- Test: `NFR-2: cross-tenant data access returns empty`

### Developer Privacy (Anti-Surveillance)
- Developers never see manager notes about them
- Developers only see feedback on their own PRs
- Developers cannot see other team members' scores/coaching (only their own)
- No ranking tables are visible to devs

### Manager Capabilities
- Can create private notes about developers (never visible to dev)
- Can review disputes and override scores
- Can see team trends and alerts
- Can drill down into any team member's profile

### Audit Compliance
- Every action is logged (INSERT into audit_log by service)
- Managers can audit who changed what, when
- Audit log includes model_version and tokens for scoring actions

## Testing

**Unit Tests:** `tests/rls.test.ts`
- NFR-2: Cross-tenant access blocked
- Developer data privacy verified
- Manager note isolation verified
- Dispute access control verified
- Audit log access control verified
- All tables have RLS enabled

**Integration Tests:** In Phase 2–3 (auth + ingestion)

## Helper Functions

RLS uses helper functions to determine user context:
- `auth.user_id()` — Current authenticated user
- `current_workspace_id()` — User's workspace (from memberships)
- `user_role_in_workspace(workspace_id)` — User's role (developer/manager/admin)

These are created in the migration and used in all policies.

## Enabling RLS

All tables have RLS enabled via:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

Policies are created with:
```sql
CREATE POLICY policy_name ON table_name FOR operation
  USING (condition)
  WITH CHECK (condition);
```

## Next Steps

- Phase 1.3: Seed data with demo workspace + team
- Phase 2: Auth integration (ensure JWT payloads match RLS assumptions)
- Phase 3: Ingestion (scoring service uses service_role for inserts)
