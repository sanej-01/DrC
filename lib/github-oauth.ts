/**
 * GitHub OAuth client for user authentication and repo access
 * Distinct from GitHub App (webhook) — this is for per-user OAuth tokens
 * Phase 2.3: GitHub OAuth linking
 */

import { Octokit } from "octokit";

const githubOAuthClientId = process.env.GITHUB_OAUTH_CLIENT_ID || "";
const githubOAuthClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || "";
const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI || "";

/**
 * Build GitHub OAuth authorization URL
 * User is redirected to this URL to authorize the app
 */
export function getGitHubOAuthURL(state: string): string {
  if (!githubOAuthClientId || !redirectUri) {
    throw new Error("GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_REDIRECT_URI required");
  }

  const params = new URLSearchParams({
    client_id: githubOAuthClientId,
    redirect_uri: redirectUri,
    scope: "repo read:user", // Scopes needed: read repos, read user info
    state, // CSRF protection
    allow_signup: "true",
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
}> {
  if (!githubOAuthClientId || !githubOAuthClientSecret || !redirectUri) {
    throw new Error("GitHub OAuth config missing");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: githubOAuthClientId,
      client_secret: githubOAuthClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange OAuth code for token");
  }

  return response.json();
}

/**
 * Get authenticated user's GitHub info
 * Used to populate github_handle, github_id, etc.
 */
export async function getGitHubUser(accessToken: string): Promise<{
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
  name: string | null;
}> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.rest.users.getAuthenticated();

  return {
    id: data.id,
    login: data.login,
    email: data.email,
    avatar_url: data.avatar_url,
    name: data.name,
  };
}

/**
 * Test token validity by making a simple API call
 */
export async function testGitHubToken(accessToken: string): Promise<boolean> {
  try {
    await getGitHubUser(accessToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke GitHub OAuth token
 * Called when user disconnects GitHub account
 */
export async function revokeGitHubToken(accessToken: string): Promise<void> {
  if (!githubOAuthClientId || !githubOAuthClientSecret) {
    throw new Error("GitHub OAuth config missing");
  }

  const octokit = new Octokit({ auth: accessToken });

  // Revoke all tokens for this app from the user's account
  await octokit.rest.apps.revokeAuthorization({
    client_id: githubOAuthClientId,
    access_token: accessToken,
  });
}
