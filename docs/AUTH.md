# Authentication & Authorization

Phase 2 implementation guide for Supabase Auth + RBAC.

## Phase 2.1 — Supabase Auth

### Setup

**Supabase Auth Providers**
- Email/Password (local testing)
- GitHub OAuth (production + PR integration)

**Configuration**
1. Supabase dashboard → Authentication → Providers
2. Enable Email provider (on by default)
3. Add GitHub provider (for Phase 3 GitHub integration)
4. GitHub app credentials in `.env.local`

**Environment Variables**
```env
# Already set
NEXT_PUBLIC_SUPABASE_URL=https://vlagqisahvksuzghhbnc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# Add for GitHub OAuth (Phase 3)
GITHUB_OAUTH_CLIENT_ID=your_github_app_id
GITHUB_OAUTH_CLIENT_SECRET=your_github_app_secret
```

### Files

- **`lib/auth-context.tsx`** — React context for auth state
  - `useAuth()` hook to access user, session, signIn, signUp, signOut
  - Manages Supabase session subscription
  
- **`middleware.ts`** — Route protection
  - Redirects unauthenticated users to /auth/sign-in
  - Allows public routes: /auth/sign-in, /auth/sign-up, /
  
- **`app/auth/sign-in/page.tsx`** — Sign-in form
  - Email + password input
  - Error display
  - Redirects to home on success
  
- **`app/auth/sign-out/page.tsx`** — Sign-out handler
  - Clears session
  - Redirects to sign-in
  
- **`app/page.tsx`** — Home (protected)
  - Redirects to sign-in if not authenticated
  - Shows current user email
  - Sign-out button
  
- **`app/layout.tsx`** — Root layout
  - Wraps app in AuthProvider

### Usage

**Sign In**
```tsx
const { signIn } = useAuth();
await signIn("user@example.com", "password");
```

**Sign Up**
```tsx
const { signUp } = useAuth();
await signUp("user@example.com", "password", "Display Name");
```

**Sign Out**
```tsx
const { signOut } = useAuth();
await signOut();
```

**Protected Component**
```tsx
"use client";
import { useAuth } from "@/lib/auth-context";

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return null; // Redirected by middleware

  return <div>Hello {user.email}</div>;
}
```

## Phase 2.2 — RBAC (Role-Based Access Control)

**Roles** (stored in `memberships` table):
- `developer` — See own data
- `manager` — See team data
- `admin` — See all workspace data

**Enforcement Points**
- API middleware: Check JWT role claim
- RLS policies: Database-level enforcement
- Frontend: Show/hide UI based on role

**Implementation** (Phase 2.2):
1. Add role claim to JWT
2. Create API middleware to check role
3. Protect routes: `/api/admin/*`, `/api/manager/*`, `/api/developer/*`
4. Verify RLS policies grant correct access

## Phase 2.3 — GitHub OAuth Linking

**Distinct from Login**
- Login: Supabase Auth (user identity)
- Repo Access: GitHub OAuth (linked provider)

**Flow**
1. User logs in via email/Supabase
2. User links GitHub account (separate OAuth flow)
3. GitHub token stored in Supabase Vault (never DB)
4. Token used for PR ingestion, webhook registration

**Implementation** (Phase 2.3):
1. Add GitHub provider to Supabase Auth
2. Create "Link GitHub" button in settings
3. Store token in Vault on link
4. Verify token not in DB/logs (TC-NFR-003)

## Phase 2.4 — Workspace Onboarding

**Manager Creates Workspace**
1. Sign up / sign in
2. Create workspace (name, slug)
3. Select GitHub repos
4. Enqueue 90-day backfill

**Implementation** (Phase 2.4):
1. Create workspace creation flow
2. GitHub repo browser (list accessible repos)
3. Backfill queue initialization

## Phase 2.5 — Developer Invite

**Manager Invites Developer**
1. Generate invite link
2. Developer clicks link
3. Developer signs up / joins
4. Enqueue 90-day backfill

**Duplicate Guard**
- GitHub handle uniqueness constraint
- Prevent duplicate memberships

**Implementation** (Phase 2.5):
1. Create invite link generation
2. Parse invite link on sign-up
3. Auto-join workspace
4. Backfill queue initialization

## Testing

**Unit Tests** (coming): `tests/auth.test.ts`
- Sign-in form structure
- Sign-out flow
- Protected route redirects

**E2E Tests** (Phase 2+):
- Full sign-in flow with Supabase
- Role-based access control
- GitHub OAuth linking
- Workspace onboarding
- Developer invite flow

**Demo Credentials** (Seed Data)
- Email: aisha@example.com
- Password: (from Supabase seed setup)
- Role: developer

## Security

✅ Passwords hashed by Supabase Auth  
✅ Session tokens in Supabase (not code)  
✅ GitHub tokens in Vault (not DB/logs)  
✅ Middleware redirects unauthenticated requests  
✅ RLS policies enforce role-based access  
✅ JWT contains role for API authorization  

## Next Steps

- Phase 2.2: RBAC enforcement
- Phase 2.3: GitHub OAuth linking
- Phase 2.4: Workspace onboarding
- Phase 2.5: Developer invite
