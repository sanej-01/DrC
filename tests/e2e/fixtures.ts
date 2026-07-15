/**
 * E2E Test Fixtures — Phase 9.2
 * Shared test data and setup for end-to-end flows
 */

import { test as base } from '@playwright/test';

export const TEST_USERS = {
  developer: {
    email: 'dev@example.com',
    password: 'Test123!Secure',
    name: 'Developer Alice',
    githubHandle: 'alice-dev',
  },
  manager: {
    email: 'manager@example.com',
    password: 'Test123!Secure',
    name: 'Manager Bob',
    githubHandle: 'bob-mgr',
  },
  admin: {
    email: 'admin@example.com',
    password: 'Test123!Secure',
    name: 'Admin Charlie',
    githubHandle: 'charlie-admin',
  },
};

export const TEST_WORKSPACE = {
  name: 'Test Platform Squad',
  slug: 'platform-squad',
  description: 'Test workspace for E2E flows',
};

export const TEST_REPO = {
  owner: 'sanej-01',
  name: 'test-repo',
  fullName: 'sanej-01/test-repo',
  url: 'https://github.com/sanej-01/test-repo',
};

export const TEST_PR = {
  number: 42,
  title: 'Add user authentication',
  description: 'Implements OAuth login flow',
  branch: 'feature/oauth-login',
  baseBranch: 'main',
  additions: 156,
  deletions: 23,
  filesChanged: 8,
};

export const TEST_PR_SCORE = {
  code_quality: 88,
  bug_risk: 15,
  architecture: 82,
  test_coverage: 91,
};

export type AuthedFixtures = {
  authenticatedPage: any;
  developerPage: any;
  managerPage: any;
};

/**
 * Fixture: Pre-authenticated page as developer
 */
export const authenticatedDeveloper = base.extend<AuthedFixtures>({
  developerPage: async ({ page }: any, use: any) => {
    // TODO: Implement login flow
    // await page.goto('/auth/sign-in');
    // await page.fill('input[name="email"]', TEST_USERS.developer.email);
    // await page.fill('input[name="password"]', TEST_USERS.developer.password);
    // await page.click('button:has-text("Sign In")');
    // await page.waitForNavigation();

    await use(page);
  },
});

/**
 * Fixture: Pre-authenticated page as manager
 */
export const authenticatedManager = base.extend<AuthedFixtures>({
  managerPage: async ({ page }: any, use: any) => {
    // TODO: Implement login flow as manager
    await use(page);
  },
});

/**
 * Helper: Create a workspace and invite team member
 */
export async function setupWorkspace(page: any) {
  // TODO: Navigate to workspace creation
  // TODO: Fill form with TEST_WORKSPACE details
  // TODO: Create workspace
  // TODO: Return workspace ID
  return 'workspace-id-123';
}

/**
 * Helper: Link GitHub repo to workspace
 */
export async function linkGitHubRepo(page: any, workspaceId: string) {
  // TODO: Navigate to repo settings
  // TODO: Click "Link Repository"
  // TODO: Select TEST_REPO
  // TODO: Authorize GitHub App
  // TODO: Verify repo linked
  return 'repo-id-123';
}

/**
 * Helper: Simulate GitHub webhook for merged PR
 */
export async function triggerPRWebhook(
  prNumber: number = TEST_PR.number,
  action: 'opened' | 'closed' | 'merged' = 'closed'
) {
  // TODO: Send webhook POST to /api/webhooks/github
  // Body: GitHub PR webhook payload
  // Expected: 200 OK, PR enqueued for scoring
  return { prId: 'pr-id-123', status: 'enqueued' };
}

/**
 * Helper: Poll for PR score to complete
 */
export async function waitForPRScore(
  page: any,
  prNumber: number,
  maxWaitMs: number = 30000
) {
  // TODO: Poll /api/scoring/status?pr_number=42
  // TODO: Wait until status = 'scored' or error
  // TODO: Return score or throw timeout
  return TEST_PR_SCORE;
}

/**
 * Helper: Invite team member to workspace
 */
export async function inviteTeamMember(
  page: any,
  workspaceId: string,
  email: string,
  role: 'developer' | 'manager' = 'developer'
) {
  // TODO: Navigate to workspace settings
  // TODO: Click "Invite Team Member"
  // TODO: Fill email and role
  // TODO: Send invite
  // TODO: Return invite link or token
  return 'invite-token-123';
}

/**
 * Helper: Accept team invite
 */
export async function acceptInvite(page: any, inviteToken: string) {
  // TODO: Navigate to invite link
  // TODO: Click "Accept Invite"
  // TODO: Verify redirected to workspace
  return true;
}

/**
 * Helper: Get developer dashboard
 */
export async function getDeveloperDashboard(page: any) {
  // TODO: Navigate to /dashboard
  // TODO: Wait for data load
  // TODO: Return dashboard data
  return {
    score_30d: 88,
    pr_count: 5,
    coaching_cards: [],
  };
}

/**
 * Helper: Get coaching cards for developer
 */
export async function getCoachingCards(page: any) {
  // TODO: Fetch from API or UI
  // TODO: Return array of coaching cards
  return [];
}

/**
 * Helper: Ask coaching question
 */
export async function askCoachQuestion(page: any, question: string) {
  // TODO: Navigate to coach panel
  // TODO: Type question
  // TODO: Click Send
  // TODO: Wait for response
  // TODO: Return response text
  return 'AI coaching response here...';
}

/**
 * Helper: Dispute a PR score
 */
export async function disputePRScore(
  page: any,
  prNumber: number,
  reason: string
) {
  // TODO: Find PR in dashboard or manager view
  // TODO: Click "Dispute"
  // TODO: Fill reason
  // TODO: Submit
  // TODO: Return dispute ID
  return 'dispute-id-123';
}

/**
 * Helper: Review and resolve dispute (manager)
 */
export async function resolveDispute(
  page: any,
  disputeId: string,
  action: 'accept' | 'reject',
  comment?: string
) {
  // TODO: Navigate to dispute queue
  // TODO: Find dispute by ID
  // TODO: Click Accept or Reject
  // TODO: Optionally add comment
  // TODO: Verify resolved
  return true;
}
