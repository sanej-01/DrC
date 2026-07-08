/**
 * GitHub API client for Dr. Codium
 * Used for PR ingestion and webhook verification
 */

import { Octokit } from "octokit";
import crypto from "crypto";

const githubAppId = process.env.GITHUB_APP_ID || "";
const githubPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || "";
const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "";

/**
 * Create GitHub App client for API calls
 * Uses private key for JWT auth
 */
export function createGitHubAppClient() {
  if (!githubAppId || !githubPrivateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY required");
  }

  return new Octokit({
    authStrategy: require("@octokit/auth-app").createAppAuth,
    auth: {
      appId: githubAppId,
      privateKey: githubPrivateKey,
    },
  });
}

/**
 * Verify webhook signature (HMAC-SHA256)
 * GitHub sends X-Hub-Signature-256 header with format: sha256=<hex>
 * TC-ING-002: Bad HMAC signature → 401, not enqueued, security log
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!githubWebhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET not configured");
    return false;
  }

  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", githubWebhookSecret)
    .update(payload)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extract PR metadata from GitHub webhook payload
 */
export interface PRMetadata {
  github_pr_id: number;
  pr_node_id: string; // GraphQL node ID for dedup (TC-ING-003)
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  title: string;
  url: string;
  author_github_handle: string;
  merged_at: string;
  additions: number;
  deletions: number;
  files_changed: number;
  raw_diff?: string; // NOT STORED (TC-SCR-010) — processed in-memory only
}

/**
 * Parse PR metadata from webhook payload
 * Webhook trigger: pull_request.closed with merged=true
 */
export function extractPRMetadata(webhookPayload: any): PRMetadata | null {
  const action = webhookPayload.action;
  const pr = webhookPayload.pull_request;

  // Only process merged PRs
  if (action !== "closed" || !pr.merged_at || !pr.merged) {
    return null;
  }

  return {
    github_pr_id: pr.id,
    pr_node_id: pr.node_id,
    repo_owner: webhookPayload.repository.owner.login,
    repo_name: webhookPayload.repository.name,
    pr_number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author_github_handle: pr.user.login,
    merged_at: pr.merged_at,
    additions: pr.additions,
    deletions: pr.deletions,
    files_changed: pr.changed_files,
    // raw_diff is intentionally NOT included (TC-SCR-010)
  };
}

/**
 * Get PR diff from GitHub API
 * Used during scoring (in-memory only, never persisted)
 * TC-SCR-010: Diff never stored in DB
 */
export async function getPRDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const octokit = createGitHubAppClient();

  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    headers: {
      accept: "application/vnd.github.v3.diff",
    },
  } as any);

  return data as unknown as string;
}

/**
 * List repository PRs for backfill (Phase 2.4 / 2.5)
 * Used during workspace onboarding and dev invite
 */
export async function listRepositoryPRs(
  owner: string,
  repo: string,
  daysBack: number = 90
): Promise<any[]> {
  const octokit = createGitHubAppClient();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);

  const prs: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "closed",
      since: sinceDate.toISOString(),
      per_page: 100,
      page,
    });

    if (data.length === 0) {
      hasMore = false;
      break;
    }

    // Filter to merged PRs only
    prs.push(...data.filter((pr) => pr.merged_at));
    page++;
  }

  return prs;
}
