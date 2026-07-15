# Security Audit Guide — Phase 10.3

Comprehensive security review before MVP launch.

---

## Overview

Security audit validates that Dr. Codium meets industry standards for data protection, authentication, and secure coding practices.

**Scope**: Authentication, authorization, data protection, API security, infrastructure
**Duration**: 1 week
**Success Criteria**: Zero critical vulnerabilities

---

## Authentication & Authorization Audit

### GitHub OAuth Implementation

**Checklist**:
- [ ] OAuth code exchange validates state parameter
- [ ] Access token stored securely (httpOnly cookie)
- [ ] Refresh token rotation implemented
- [ ] User cannot access other users' refresh tokens
- [ ] Session timeout: 24 hours max
- [ ] Logout clears all session data

**Test Cases**:
```bash
# Test 1: OAuth code parameter required
curl https://app.dr-codium.com/api/auth/github/callback
# Expected: 400 Bad Request (missing code)

# Test 2: Invalid code rejected
curl "https://app.dr-codium.com/api/auth/github/callback?code=invalid"
# Expected: 401 Unauthorized

# Test 3: State parameter validation
# Simulate CSRF attack by omitting state
# Expected: 403 Forbidden or 400 Bad Request
```

### Row-Level Security (RLS)

**Checklist**:
- [ ] All public tables have RLS enabled
- [ ] RLS policies enforce workspace isolation
- [ ] RLS policies enforce role-based access
- [ ] SELECT policies verified for each role
- [ ] INSERT/UPDATE/DELETE policies restrict correctly

**Audit Query**:
```sql
-- Verify RLS enabled on all public tables
SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%';

-- Verify policies exist
SELECT table_name, policy_name, definition
  FROM information_schema.row_security_policies
  ORDER BY table_name;

-- Test developer cannot see other developer's scores
SELECT COUNT(*) FROM pull_requests 
  WHERE user_id != current_user_id;
-- Expected: 0 (or filtered by workspace)
```

### API Authentication

**Checklist**:
- [ ] All protected routes require valid JWT
- [ ] JWT signature verified on every request
- [ ] JWT expiration checked
- [ ] Cron routes verify CRON_SECRET header
- [ ] GitHub webhook routes verify X-Hub-Signature

**Test Cases**:
```bash
# Test 1: Missing authorization header
curl https://app.dr-codium.com/api/manager/team/stats
# Expected: 401 Unauthorized

# Test 2: Invalid JWT
curl -H "Authorization: Bearer invalid_token" \
  https://app.dr-codium.com/api/manager/team/stats
# Expected: 401 Unauthorized

# Test 3: Expired JWT
# Generate expired token, submit
# Expected: 401 Unauthorized

# Test 4: Cron route without secret
curl -X POST https://app.dr-codium.com/api/cron/poll-github
# Expected: 401 Unauthorized

# Test 5: Cron route with invalid secret
curl -X POST -H "Authorization: Bearer wrong_secret" \
  https://app.dr-codium.com/api/cron/poll-github
# Expected: 401 Unauthorized
```

---

## Data Protection Audit

### Secret Management

**Checklist**:
- [ ] No secrets in environment variable defaults
- [ ] No secrets in git history
- [ ] All production secrets in Vercel encrypted storage
- [ ] Secrets not logged to console
- [ ] GitHub webhook secret is strong (32+ chars)
- [ ] Cron secret is strong (32+ chars)

**Verification**:
```bash
# Check for secrets in git history
git log --grep="secret\|password\|key" -i

# Check for secrets in source code
grep -r "password\|api_key\|secret" app/ lib/ --exclude-dir=node_modules
# Expected: No matches (or only documentation)

# Verify .env.local not committed
git ls-files | grep .env.local
# Expected: No results
```

### API Key Handling

**Anthropic API Key**:
- [ ] Key never logged
- [ ] Key transmitted over HTTPS only
- [ ] Key stored as server-side environment variable
- [ ] Key not sent to frontend
- [ ] Rate limiting configured per workspace
- [ ] Cost cap enforced per workspace per day

**GitHub App Private Key**:
- [ ] Key not logged
- [ ] Key stored base64 encoded
- [ ] Key only used for internal webhook verification
- [ ] Key rotated annually

---

### Data Encryption

**Checklist**:
- [ ] All data transmitted over HTTPS
- [ ] Sensitive fields encrypted at rest:
  - [ ] GitHub OAuth tokens
  - [ ] API keys in database (if stored)
  - [ ] User session data

**Configuration**:
```yaml
# Vercel HTTPS
- Auto-enabled by default ✓
- SSL certificate auto-renewed ✓

# Supabase at-rest encryption
- Enabled by default ✓
- Encryption key managed by Supabase ✓
```

### Data Retention & Deletion

**Checklist**:
- [ ] PR data retained for 90 days minimum
- [ ] Coaching data retained for 2 years
- [ ] Audit logs retained for 3 years (compliance)
- [ ] User deletion triggers cascade delete
- [ ] Soft-delete implemented for audit trail

**Test Cases**:
```sql
-- Verify soft-delete (deleted_at column)
SELECT * FROM pull_requests WHERE deleted_at IS NOT NULL;

-- Verify audit log immutability
UPDATE audit_log SET action = 'HACKED' WHERE id = 1;
-- Expected: Permission denied (RLS)

-- Verify user deletion cascades
DELETE FROM auth.users WHERE id = 'test-user-id';
-- Expect: All related data deleted
```

---

## Input Validation & Injection Prevention

### SQL Injection

**Checklist**:
- [ ] All database queries use parameterized queries
- [ ] No string concatenation in SQL
- [ ] Supabase client library used (prevents injection)
- [ ] Raw SQL queries tested for injection

**Test Cases**:
```bash
# Test: SQL injection in workspace name
curl -X POST https://app.dr-codium.com/api/workspace/create \
  -d "name='; DROP TABLE workspaces; --"
# Expected: 400 Bad Request (validation error, not injection)

# Test: Injection in PR filter
curl "https://app.dr-codium.com/api/prs?filter=1' OR '1'='1"
# Expected: 400 Bad Request (parameterized query)
```

### XSS (Cross-Site Scripting)

**Checklist**:
- [ ] All user input sanitized before display
- [ ] Content Security Policy headers set
- [ ] No innerHTML used (React safe by default)
- [ ] SVG content sanitized
- [ ] Markdown rendered safely (if used)

**Test Cases**:
```bash
# Test: XSS in coaching card title
POST /api/coaching/create
{
  "title": "<img src=x onerror='alert(1)'>",
  "description": "test"
}
# Expected: Title sanitized/escaped in response

# Test: XSS in manager note
POST /api/manager/team/[id]/notes
{
  "content": "<script>alert('xss')</script>"
}
# Expected: Script tags escaped or removed
```

### CSRF (Cross-Site Request Forgery)

**Checklist**:
- [ ] CSRF tokens on state-changing forms
- [ ] SameSite cookie attribute set to Strict
- [ ] Sensitive actions require re-authentication
- [ ] POST/PUT/DELETE require CSRF token

**Configuration**:
```typescript
// Verify SameSite on auth cookie
Set-Cookie: session=...; SameSite=Strict; Secure; HttpOnly;

// Verify CSRF token on forms
<form method="POST">
  <input type="hidden" name="csrf_token" value="...">
</form>
```

---

## Access Control Audit

### Role-Based Access Control (RBAC)

**Checklist**:
- [ ] Developer cannot access other developers' data
- [ ] Developer cannot access manager views
- [ ] Manager cannot access admin views
- [ ] Manager can only see their workspace members
- [ ] Admin has full workspace access
- [ ] No privilege escalation possible

**Test Cases**:
```bash
# Test 1: Developer accesses manager view
curl -H "Authorization: Bearer dev-token" \
  https://app.dr-codium.com/api/manager/team/stats
# Expected: 403 Forbidden

# Test 2: Developer views another developer's scores
curl -H "Authorization: Bearer dev-token" \
  https://app.dr-codium.com/api/developer/other-user-id/stats
# Expected: 403 Forbidden

# Test 3: Manager views admin dashboard
curl -H "Authorization: Bearer mgr-token" \
  https://app.dr-codium.com/api/vp/portfolio
# Expected: 403 Forbidden or 401 Unauthorized

# Test 4: Cross-workspace access attempt
# Manager from workspace A tries to access workspace B
curl -H "Authorization: Bearer workspace-a-token" \
  https://app.dr-codium.com/api/workspace/b/team
# Expected: 403 Forbidden
```

### Workspace Isolation

**Checklist**:
- [ ] Workspaces completely isolated
- [ ] User cannot access other workspace members
- [ ] Workspace data in API responses filtered correctly
- [ ] GitHub webhook filtered by workspace
- [ ] Scoring isolated to workspace

**Database Isolation Verification**:
```sql
-- Verify workspace_id filter on sensitive queries
SELECT * FROM pull_requests 
  WHERE workspace_id = current_setting('app.workspace_id')
  -- Expected: User can only see their workspace

-- Verify RLS policy blocks cross-workspace access
SELECT * FROM pull_requests 
  WHERE workspace_id != current_setting('app.workspace_id')
-- Expected: 0 rows (RLS blocks)
```

---

## API Security Audit

### Rate Limiting

**Checklist**:
- [ ] API rate limiting configured (e.g., 100 req/min)
- [ ] Coach panel rate limited (10 req/min per user)
- [ ] Webhook rate limiting (1000 req/min)
- [ ] 429 Too Many Requests on exceeds

**Test Cases**:
```bash
# Simulate rate limit exceed
for i in {1..15}; do
  curl -H "Authorization: Bearer user-token" \
    https://app.dr-codium.com/api/coach/query
done
# Expect: 429 on requests 11-15
```

### API Versioning & Deprecation

**Checklist**:
- [ ] API version in URL (e.g., /api/v1)
- [ ] Deprecation path planned
- [ ] Old API versions supported for 6+ months
- [ ] Clients notified of deprecation

---

## Infrastructure Security Audit

### Vercel Configuration

**Checklist**:
- [ ] HTTPS enforced (auto)
- [ ] Security headers set:
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: SAMEORIGIN
  - [ ] X-XSS-Protection: 1; mode=block
  - [ ] Strict-Transport-Security

**Verification**:
```bash
curl -I https://app.dr-codium.com
# Check response headers
```

### Environment Variables

**Checklist**:
- [ ] Secrets stored in Vercel encrypted storage
- [ ] Secrets not in .env files
- [ ] Secrets not in git history
- [ ] Preview environment secrets different from prod
- [ ] Secret rotation policy defined

**Verification**:
```bash
vercel env ls
# Should show all secrets (values masked)
```

### Database Security

**Checklist**:
- [ ] PostgreSQL default credentials changed
- [ ] Connection SSL required
- [ ] Backup encryption enabled
- [ ] Point-in-time recovery enabled
- [ ] Database audit logging enabled

**Supabase Configuration**:
- SSL mode: require ✓
- Backups: daily ✓
- PITR: enabled ✓

---

## Compliance & Legal

### Data Privacy (GDPR/CCPA)

**Checklist**:
- [ ] Privacy policy published
- [ ] Cookie consent banner (if cookies used)
- [ ] User data export capability
- [ ] User data deletion capability
- [ ] DPA (Data Processing Agreement) ready for enterprise

**Features to Implement**:
```typescript
// User data export endpoint
GET /api/user/export
// Returns: All user data in JSON format

// User data deletion endpoint
DELETE /api/user/data
// Cascades to all related records
```

### Terms of Service

**Checklist**:
- [ ] Terms published on website
- [ ] Acceptance required at signup
- [ ] Clear liability limitations
- [ ] Security practices documented
- [ ] SLA defined (if applicable)

### Logging & Monitoring

**Checklist**:
- [ ] Audit log for all data modifications
- [ ] Admin action logging
- [ ] Failed login attempts logged
- [ ] API error logging (without secrets)
- [ ] Retention: 3 years minimum

---

## Security Testing Schedule

**Day 1**: Authentication & Authorization
- OAuth flow testing
- RLS policy verification
- Role-based access testing

**Day 2**: Data Protection
- Secret scanning
- Encryption verification
- Retention policy testing

**Day 3**: Input Validation
- SQL injection testing
- XSS payload testing
- CSRF token verification

**Day 4**: Access Control
- Role escalation attempts
- Cross-workspace access testing
- API permission testing

**Day 5**: Infrastructure & Compliance
- Security headers verification
- Database security audit
- Privacy checklist review

---

## Security Issue Severity

### Critical (Fix immediately)
- SQL injection vulnerability
- Authentication bypass
- Data exposure (PII)
- Privilege escalation
- RLS bypass

### High (Fix within 1 week)
- XSS vulnerability
- CSRF vulnerability
- Weak password requirements
- Session fixation
- API key exposure

### Medium (Fix within 1 month)
- Missing security headers
- Weak rate limiting
- Verbose error messages
- Missing audit logging

### Low (Fix in next release)
- Security policy updates
- Documentation improvements
- Minor hardening

---

## Security Incident Response Plan

**If critical vulnerability found**:
1. Immediately notify CTO/security lead
2. Isolate affected systems
3. Begin investigation
4. Fix vulnerability
5. Test fix thoroughly
6. Deploy to production
7. Notify affected users
8. Post-incident review

---

## Post-Audit Checklist

- [ ] All findings documented
- [ ] Critical issues fixed
- [ ] High issues scheduled for fix
- [ ] Medium/low issues backlogged
- [ ] Security team sign-off obtained
- [ ] Penetration test scheduled (optional)
- [ ] Security documentation updated

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [GDPR Compliance](https://gdpr-info.eu/)
