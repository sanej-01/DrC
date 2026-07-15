# User Acceptance Testing (UAT) Guide — Phase 10.1

Structured testing with beta users to validate MVP functionality and user experience.

---

## Overview

UAT validates that Dr. Codium MVP meets business requirements and user expectations across all roles (developer, manager, admin).

**Test Duration**: 2 weeks
**Participants**: 15-20 beta users (5-7 per role)
**Success Criteria**: >95% test pass rate, <3 critical issues

---

## UAT Environment Setup

### Test Accounts

Create test accounts for each role:

```sql
-- Developer accounts (5 accounts)
INSERT INTO auth.users (email, user_metadata) VALUES
  ('dev-test-1@example.com', '{"role":"developer"}'),
  ('dev-test-2@example.com', '{"role":"developer"}'),
  -- ... etc

-- Manager accounts (5 accounts)
INSERT INTO auth.users (email, user_metadata) VALUES
  ('mgr-test-1@example.com', '{"role":"manager"}'),
  -- ... etc

-- Admin accounts (2 accounts)
INSERT INTO auth.users (email, user_metadata) VALUES
  ('admin-test-1@example.com', '{"role":"admin"}'),
  -- ... etc
```

### Test Workspace

Create a dedicated UAT workspace:

```json
{
  "name": "UAT Test Workspace",
  "slug": "uat-test",
  "description": "Testing environment for UAT",
  "daily_cost_cap": 100000,  // Higher cap for testing
  "scoring_enabled": true
}
```

### Test GitHub Repo

Create a test GitHub repository for PR ingestion:

- **Repo**: `sanej-01/uat-test-repo`
- **Public**: Yes (to allow test PRs)
- **Webhook**: Configured to point to staging/production
- **Sample Data**: 10-15 sample PRs with scores already computed

---

## UAT Test Cases

### F1: Onboarding & Team Setup

**TC-UAT-F1-001: Admin Signup and Workspace Creation**
- **Actor**: Admin
- **Steps**:
  1. Navigate to sign-up page
  2. Enter email and password
  3. Create workspace with name and description
  4. Verify redirected to workspace dashboard
- **Expected**: Workspace created, admin can access settings
- **Pass Criteria**: Workspace visible in admin panel

**TC-UAT-F1-002: Admin Invites Developer**
- **Actor**: Admin
- **Steps**:
  1. Go to Workspace Settings → Team
  2. Click "Invite Team Member"
  3. Enter developer email and role
  4. Send invite
- **Expected**: Invite email sent, visible in team list as "pending"
- **Pass Criteria**: Invite shows as "pending", email received

**TC-UAT-F1-003: Developer Accepts Invite**
- **Actor**: Developer
- **Steps**:
  1. Click invite link in email
  2. Sign up with GitHub OAuth
  3. Accept workspace invite
- **Expected**: Developer joins workspace, sees onboarding
- **Pass Criteria**: Developer can access dashboard

**TC-UAT-F1-004: Link GitHub Repo**
- **Actor**: Admin
- **Steps**:
  1. Go to Workspace Settings → Repos
  2. Click "Link Repository"
  3. Authorize GitHub App
  4. Select test repo
  5. Confirm linking
- **Expected**: Repo linked, webhooks configured
- **Pass Criteria**: Webhooks visible in GitHub, "linked" status shown

---

### F2: PR Ingestion & Scoring

**TC-UAT-F2-001: Create and Merge PR**
- **Actor**: Developer
- **Steps**:
  1. Create test PR on linked repo
  2. Add meaningful code changes
  3. Merge PR to main
- **Expected**: PR appears in Dr. Codium within 2 minutes
- **Pass Criteria**: PR visible with score and dimensions

**TC-UAT-F2-002: Score Computation**
- **Actor**: Developer (observer)
- **Steps**:
  1. View merged PR in dashboard
  2. Observe score breakdown
  3. Check dimensions (quality, risk, architecture, tests)
- **Expected**: Score 0-100, each dimension 0-100
- **Pass Criteria**: All dimensions present, reasonable scores

**TC-UAT-F2-003: Score Accuracy**
- **Actor**: Reviewer (manual check)
- **Steps**:
  1. Inspect PR code quality
  2. Compare with computed score
  3. Verify score reflects actual code
- **Expected**: Score aligns with code quality
- **Pass Criteria**: Score matches subjective assessment

**TC-UAT-F2-004: High-Volume PR Scoring**
- **Actor**: Load tester
- **Steps**:
  1. Submit 20 PRs sequentially (spaced 10 seconds apart)
  2. Monitor scoring queue
  3. Verify all PRs eventually score
- **Expected**: All PRs scored within 5 minutes
- **Pass Criteria**: 100% of PRs scored, <1% error rate

---

### F3: Developer Dashboard

**TC-UAT-F3-001: Dashboard Loads**
- **Actor**: Developer
- **Steps**:
  1. Login as developer
  2. Navigate to /app/dashboard
  3. Wait for data load
- **Expected**: Dashboard loads within 3 seconds
- **Pass Criteria**: All components render, no console errors

**TC-UAT-F3-002: Growth Ring Displays**
- **Actor**: Developer
- **Steps**:
  1. View growth ring on dashboard
  2. Verify score displayed (0-100)
  3. Check color gradient (red→green)
- **Expected**: Ring shows current 30-day score
- **Pass Criteria**: Score accurate, colors correct

**TC-UAT-F3-003: Dimension Tiles**
- **Actor**: Developer
- **Steps**:
  1. View 4 dimension tiles
  2. Verify each shows score + confidence badge
  3. Check trend arrows (↑/↓/→)
- **Expected**: All dimensions present with trends
- **Pass Criteria**: All tiles render, trends accurate

**TC-UAT-F3-004: Coaching Cards (Quests)**
- **Actor**: Developer
- **Steps**:
  1. View Quests section
  2. Count coaching cards
  3. Verify severity colors (green/blue/red/amber)
- **Expected**: 5 most recent coaching cards visible
- **Pass Criteria**: Cards render, colors accurate

---

### F4: Coaching & Feedback

**TC-UAT-F4-001: View Coaching Card Details**
- **Actor**: Developer
- **Steps**:
  1. Click on coaching card
  2. View full details page
  3. Verify title, description, file:line
- **Expected**: Detail page shows full coaching content
- **Pass Criteria**: All content readable, file link works

**TC-UAT-F4-002: Vote on Coaching**
- **Actor**: Developer
- **Steps**:
  1. Open coaching card detail
  2. Click thumbs up
  3. Verify vote recorded
  4. Click again to toggle off
- **Expected**: Vote count updates, toggle works
- **Pass Criteria**: Vote persists across reload

**TC-UAT-F4-003: Ask Coach Question**
- **Actor**: Developer
- **Steps**:
  1. Open Coach Panel
  2. Type question about score
  3. Submit
  4. Wait for response
- **Expected**: AI response generated in <10 seconds
- **Pass Criteria**: Response relevant to question

**TC-UAT-F4-004: Coach Context**
- **Actor**: Developer
- **Steps**:
  1. Ask question in Coach Panel
  2. Verify response includes context
  3. Check that response references recent PRs
- **Expected**: Response shows awareness of developer's recent work
- **Pass Criteria**: Context personalized to developer

---

### F5: Team Management (Manager View)

**TC-UAT-F5-001: Team Garden View**
- **Actor**: Manager
- **Steps**:
  1. Login as manager
  2. Navigate to /app/manager/team
  3. View team members as plants
  4. Verify growth stages shown
- **Expected**: All team members visible with stages
- **Pass Criteria**: Plants display correct stages

**TC-UAT-F5-002: Individual Drill-Down**
- **Actor**: Manager
- **Steps**:
  1. Click on team member in garden
  2. View individual developer stats
  3. Check trajectory chart
  4. View coaching history
- **Expected**: Full developer profile loads
- **Pass Criteria**: All charts render, data accurate

**TC-UAT-F5-003: Manager Notes**
- **Actor**: Manager
- **Steps**:
  1. Open developer detail page
  2. Add private note
  3. Save note
  4. Reload page and verify note persists
- **Expected**: Notes saved and persisted
- **Pass Criteria**: Note visible after reload

**TC-UAT-F5-004: Alert Tray**
- **Actor**: Manager
- **Steps**:
  1. View alert tray (bell icon)
  2. Verify score drop alerts
  3. Test snooze and dismiss
- **Expected**: Alerts update in real-time
- **Pass Criteria**: Alerts accurate, actions work

---

### F6: Admin Dashboard (VP Rollup)

**TC-UAT-F6-001: VP Dashboard Loads**
- **Actor**: Admin
- **Steps**:
  1. Login as admin
  2. Navigate to /app/vp
  3. Wait for portfolio data
- **Expected**: Dashboard loads with all sections
- **Pass Criteria**: All widgets render, no errors

**TC-UAT-F6-002: Team Aggregates**
- **Actor**: Admin
- **Steps**:
  1. View team aggregates table
  2. Verify metrics (score, quality, risk, count)
  3. Sort by score
- **Expected**: Table shows all teams, sortable
- **Pass Criteria**: Data accurate, sorting works

**TC-UAT-F6-003: Early Warnings**
- **Actor**: Admin
- **Steps**:
  1. Trigger score drop alert (merge low-scoring PR)
  2. Wait 2 minutes
  3. Check VP dashboard early warnings
- **Expected**: Warning appears in early warnings section
- **Pass Criteria**: Warning accurate and timely

**TC-UAT-F6-004: Workspace Snapshot**
- **Actor**: Admin
- **Steps**:
  1. View workspace overview stats
  2. Verify total developers, avg score, trends
- **Expected**: Stats reflect current workspace state
- **Pass Criteria**: Numbers accurate

---

### F7: Accessibility

**TC-UAT-F7-001: Keyboard Navigation**
- **Actor**: QA Engineer
- **Steps**:
  1. Navigate dashboard using only Tab key
  2. Verify focus visible on all elements
  3. Test Escape key to close modals
- **Expected**: All interactive elements reachable via keyboard
- **Pass Criteria**: Tab order logical, focus visible

**TC-UAT-F7-002: Screen Reader (NVDA/VoiceOver)**
- **Actor**: QA Engineer
- **Steps**:
  1. Enable screen reader
  2. Navigate to coaching card
  3. Verify alt text, labels, heading hierarchy
- **Expected**: Content readable by screen reader
- **Pass Criteria**: Card title, description, buttons announced

**TC-UAT-F7-003: Color Contrast**
- **Actor**: QA Engineer
- **Steps**:
  1. Use WebAIM contrast checker
  2. Verify all text meets 4.5:1 ratio
  3. Check alerts (red/green only)
- **Expected**: All text meets WCAG AA standard
- **Pass Criteria**: No color-only conveyance

---

## Test Execution

### Week 1: Core Flows

**Monday-Tuesday**: Onboarding & Setup
- UAT-F1-001 through UAT-F1-004
- Blockers: GitHub App integration

**Wednesday-Thursday**: PR & Scoring
- UAT-F2-001 through UAT-F2-004
- Verify end-to-end flow

**Friday**: Accessibility
- UAT-F7-001 through UAT-F7-003
- Fix critical accessibility issues

### Week 2: User Workflows

**Monday-Tuesday**: Developer Experience
- UAT-F3-001 through UAT-F4-004
- Coaching and feedback testing

**Wednesday-Thursday**: Manager Experience
- UAT-F5-001 through UAT-F5-004
- Team management workflows

**Friday**: Admin & Scale
- UAT-F6-001 through UAT-F6-004
- High-volume testing (UAT-F2-004)

---

## UAT Metrics

### Success Criteria

```
Overall Pass Rate: > 95% (≤2 critical failures)
Performance:       p95 < 2s, p99 < 5s
Error Rate:        < 0.5%
Accessibility:     25/25 tests passing
```

### Tracking Template

| Test Case | Result | Notes | Issue ID |
|-----------|--------|-------|----------|
| TC-UAT-F1-001 | ✓ Pass | Workspace created | - |
| TC-UAT-F1-002 | ✓ Pass | Invite sent | - |
| TC-UAT-F2-001 | ✓ Pass | PR scored in 90s | - |
| TC-UAT-F3-001 | ⚠ Fail | Dashboard slow | BUG-123 |
| ... | ... | ... | ... |

---

## Feedback Collection

### Post-Test Survey

Send to all UAT participants:

**Rate on 1-5 scale**:
- Overall usability
- Dashboard clarity
- Coaching usefulness
- Team features (managers)
- Ease of onboarding

**Open-Ended Questions**:
1. What was most confusing?
2. What worked really well?
3. What would you change?
4. Would you recommend to colleagues?

### Issue Tracking

All issues logged to GitHub Issues with labels:
- `uat-<week>`: UAT issue from week 1 or 2
- `critical`: Blocks core workflow
- `minor`: Polish/nice-to-have
- `accessibility`: A11y violation

---

## UAT Pass/Fail Criteria

### PASS: Ready for Launch
- ✓ >95% test pass rate
- ✓ All critical issues resolved
- ✓ Performance metrics met
- ✓ Accessibility tests pass
- ✓ User feedback positive (>3.5/5 avg)

### FAIL: Extend Testing
- ✗ <95% pass rate
- ✗ Critical issues unresolved
- ✗ Performance issues persist
- ✗ Accessibility violations
- ✗ Negative user feedback

### Conditional: Limited Launch
- ⚠ 90-95% pass rate with non-critical issues
- ⚠ Minor UI/UX feedback
- ⚠ Ready with post-launch fixes planned

---

## Bug Triage

### Critical (Fix before launch)
- Data loss or corruption
- Security vulnerabilities
- Scoring completely broken
- Cannot sign up or access dashboard

### Major (Fix within 1 week)
- Performance issues (>5s load time)
- Partial functionality broken
- UI rendering issues
- Accessibility blocking workflows

### Minor (Fix in next release)
- Typos or copy issues
- UI polish
- Feature polish
- Nice-to-have improvements

---

## Success Metrics

After UAT completion:

- [ ] 95%+ test cases passing
- [ ] <3 critical issues found and fixed
- [ ] Avg user satisfaction: 4.0+/5.0
- [ ] Performance targets met
- [ ] Accessibility compliant
- [ ] Team confidence: "ready to ship"

---

## Next Steps

1. **Week 3**: Fix UAT issues (critical → minor)
2. **Week 4**: Performance optimization if needed
3. **Week 5**: Security audit (Phase 10.3)
4. **Week 6**: Marketing materials and launch prep (Phase 10.4)
5. **Week 7**: Public launch

---

## Resources

- [Playwright Testing Framework](https://playwright.dev)
- [WCAG 2.1 AA Checklist](https://www.w3.org/WAI/test-evaluate/)
- [Performance Testing Guide](https://web.dev/performance/)
- [UAT Best Practices](https://www.atlassian.com/blog/qa/user-acceptance-testing)
