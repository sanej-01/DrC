# E2E Test Suite — Phase 9.2

Full Playwright end-to-end test coverage for Dr. Codium MVP critical user flows.

---

## Overview

**Test Scope**: Onboarding → PR Ingestion → Scoring → Coaching → Dispute Resolution

**Test Count**: 27 comprehensive E2E tests organized into 7 test suites

**Coverage**: All major user journeys across developer, manager, and admin roles

---

## Test Organization

### Flow 1: Onboarding + Workspace Setup (4 tests)
- TC-E2E-001: Admin signup and workspace creation
- TC-E2E-002: Admin invites developer and manager
- TC-E2E-003: Developer accepts invite and joins
- TC-E2E-004: Admin links GitHub repo to workspace

**Purpose**: Verify complete team setup flow from first user to ready-to-score state

---

### Flow 2: PR Ingestion Pipeline (3 tests)
- TC-E2E-005: Developer opens PR on GitHub
- TC-E2E-006: Developer merges PR
- TC-E2E-007: Developer sees PR score on dashboard

**Purpose**: Verify webhook ingestion and score visibility

---

### Flow 3: Scoring & Aggregates (5 tests)
- TC-E2E-008: Single PR score computed correctly
- TC-E2E-009: 30-day aggregates computed
- TC-E2E-010: Low confidence badge for <3 PRs
- TC-E2E-011: Score drop triggers alert

**Purpose**: Verify scoring accuracy, aggregate rolling averages, and alert triggering

---

### Flow 4: Coaching & Feedback (5 tests)
- TC-E2E-012: Developer views coaching cards
- TC-E2E-013: Developer opens coaching detail page
- TC-E2E-014: Developer votes on coaching feedback
- TC-E2E-015: Developer asks Coach Panel question
- TC-E2E-016: Manager views team coaching overview

**Purpose**: Verify coaching card generation, feedback voting, and AI coaching interaction

---

### Flow 5: Dispute & Resolution (4 tests)
- TC-E2E-017: Developer disputes PR score
- TC-E2E-018: Manager reviews dispute
- TC-E2E-019: Manager accepts dispute
- TC-E2E-020: Manager rejects dispute

**Purpose**: Verify complete dispute workflow including acceptance and rejection flows

---

### Flow 6: Cross-User Workflows (4 tests)
- TC-E2E-021: Manager views team garden
- TC-E2E-022: Admin views VP dashboard
- TC-E2E-023: Cost tracking works
- TC-E2E-024: Audit log records all actions

**Purpose**: Verify multi-role dashboards and system tracking

---

### Flow 7: Error Resilience (3 tests)
- TC-E2E-025: Scoring retry on transient failure
- TC-E2E-026: Permanent failure handled gracefully
- TC-E2E-027: Secret redaction before scoring

**Purpose**: Verify robustness, error handling, and security

---

## Running Tests

### Install Dependencies
```bash
npm install --save-dev @playwright/test
npm install -D @testing-library/react @testing-library/jest-dom
```

### Run All E2E Tests
```bash
npx playwright test tests/e2e/
```

### Run Specific Test Suite
```bash
# Only onboarding tests
npx playwright test tests/e2e/critical-flows.test.ts --grep "Onboarding"

# Only dispute tests
npx playwright test tests/e2e/critical-flows.test.ts --grep "Dispute"
```

### Run Single Test
```bash
npx playwright test tests/e2e/critical-flows.test.ts -g "TC-E2E-001"
```

### Generate HTML Report
```bash
npx playwright test tests/e2e/ --reporter=html
open playwright-report/index.html
```

### Run with Debugging
```bash
# Run in headed mode (see browser)
npx playwright test tests/e2e/ --headed

# Run in debug mode (step-by-step)
npx playwright test tests/e2e/ --debug

# Inspect a specific test
npx playwright test tests/e2e/critical-flows.test.ts -g "TC-E2E-001" --debug
```

---

## Test Fixtures

### Test Data
- **TEST_USERS**: Pre-configured developer, manager, admin accounts
- **TEST_WORKSPACE**: Test workspace ("Test Platform Squad")
- **TEST_REPO**: Mock GitHub repo (sanej-01/test-repo)
- **TEST_PR**: Example PR with title, branch, files changed
- **TEST_PR_SCORE**: Expected score dimensions (quality, risk, architecture, tests)

### Helper Functions
All helpers in `tests/e2e/fixtures.ts`:

```typescript
// Setup
setupWorkspace(page)           // Create workspace, return ID
linkGitHubRepo(page, wsId)     // Link repo to workspace
inviteTeamMember(page, wsId, email, role)
acceptInvite(page, token)

// PR Pipeline
triggerPRWebhook(prNumber, action)
waitForPRScore(page, prNumber, maxWaitMs)

// Dashboard
getDeveloperDashboard(page)
getCoachingCards(page)

// Coaching
askCoachQuestion(page, question)

// Disputes
disputePRScore(page, prNumber, reason)
resolveDispute(page, disputeId, action, comment)
```

---

## Implementation Notes

### Base URL
Tests use `BASE_URL` environment variable (default: `http://localhost:3000`):

```bash
BASE_URL=https://app.example.com npx playwright test tests/e2e/
```

### Authentication
Login flow stubbed with `// TODO` comments. Implement by:
1. Navigate to `/auth/sign-in`
2. Fill email/password form
3. Wait for redirect to dashboard
4. Store auth cookie/token for subsequent tests

### GitHub Webhook Simulation
Tests trigger webhooks via `POST /api/webhooks/github`:

```javascript
const payload = {
  action: 'closed',
  pull_request: {
    number: 42,
    state: 'closed',
    merged: true,
    additions: 156,
    deletions: 23,
    changed_files: 8,
  },
};
await page.request.post(`${BASE_URL}/api/webhooks/github`, {
  data: payload,
  headers: { 'X-GitHub-Event': 'pull_request' },
});
```

### Polling Patterns
Tests poll for async operations (scoring, backfill, etc.):

```typescript
async function pollUntilScored(prId: string, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const status = await page.request.get(`/api/scoring/status?pr_id=${prId}`);
    const data = await status.json();
    if (data.status === 'scored') return data;
    await page.waitForTimeout(500);
  }
  throw new Error(`Timeout waiting for score on PR ${prId}`);
}
```

---

## Accessibility Testing Note

E2E tests verify happy-path functionality. For accessibility compliance, see `tests/accessibility.test.ts` (Phase 9.1).

---

## Continuous Integration

### In CI Pipeline
```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  run: npx playwright test tests/e2e/
  env:
    BASE_URL: http://localhost:3000
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GITHUB_APP_ID: ${{ secrets.GITHUB_APP_ID }}
    GITHUB_APP_SECRET: ${{ secrets.GITHUB_APP_SECRET }}

- name: Upload Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

---

## Debugging Failed Tests

### Check Console Logs
```bash
# View browser console during test
npx playwright test tests/e2e/critical-flows.test.ts -g "TC-E2E-001" --debug
# In inspector, open DevTools (F12)
```

### Check Network Activity
```typescript
// In test setup
page.on('response', (response) => {
  console.log(`${response.request().method()} ${response.url()} ${response.status()}`);
});
```

### Check Screenshots on Failure
Tests auto-capture screenshots on failure:
```bash
# View failure screenshots
open test-results/
```

### Check Video Recordings
Configure in `playwright.config.ts`:
```typescript
use: {
  video: 'retain-on-failure',
}
```

---

## Maintenance

### Adding New Tests
1. Add test case to appropriate Flow section in `critical-flows.test.ts`
2. Use TC-E2E-NNN naming (where NNN = next number)
3. Follow JSDoc comment format (Test, Expected)
4. Add TODO steps
5. Verify test ID is unique: `grep -r "TC-E2E-" tests/e2e/`

### Updating Fixtures
1. Add new test data constant to `TEST_*` objects
2. Add new helper function with JSDoc
3. Stub with `// TODO` comments
4. Export from `fixtures.ts`

### Running Full Suite Locally
```bash
# Install all deps
npm ci

# Start dev server
npm run dev &

# Wait for server
sleep 5

# Run tests
npm run test:e2e

# Stop server
pkill -f "npm run dev"
```

---

## Success Criteria

- [x] 27 test cases written (all stubs, TODO implementation)
- [x] Test fixtures with common data and helpers created
- [x] All flows covered: onboarding → ingest → score → coach → dispute
- [x] Error resilience tests included
- [ ] Helper functions fully implemented
- [ ] Tests running locally and in CI
- [ ] All tests passing (green)
- [ ] E2E tests integrated into GitHub Actions CI/CD

---

## Next Steps (Phase 9.3)

After E2E tests are green:
1. Deploy to Vercel with environment secrets
2. Run E2E tests in staging environment
3. Verify cron poller in production
4. Monitor production metrics

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)
