/**
 * Backfill logic for PR ingestion
 * Phase 2.4 / 2.5: Backfill PRs from last 90 days
 *
 * Uses per-user GitHub OAuth tokens to fetch PR data.
 * Stores only metadata (additions, deletions, files_changed).
 * Diff is fetched in-memory only during scoring (TC-SCR-010).
 */

import { createClient } from "@supabase/supabase-js";
import { Octokit } from "octokit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Backfill PRs for a repository using developer's GitHub OAuth token
 * Called during workspace onboarding (Phase 2.4) or developer invite (Phase 2.5)
 *
 * TC-ING-004: Backfill enqueued
 */
export async function backfillRepositoryPRs(
  workspaceId: string,
  repoId: string,
  githubOwner: string,
  githubRepo: string,
  daysBack: number = 90,
  userGitHubToken?: string // Optional: use specific user's token
): Promise<{ enqueued_count: number; error?: string }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get GitHub OAuth token to use for API calls
    // If not provided, try to find a workspace member with a linked GitHub token
    let accessToken = userGitHubToken;

    if (!accessToken) {
      // Find a workspace member with GitHub OAuth token
      const { data: members } = await supabase
        .from("memberships")
        .select(
          `
          user_id,
          users:user_id(id)
        `
        )
        .eq("workspace_id", workspaceId)
        .limit(10);

      if (!members || members.length === 0) {
        return { enqueued_count: 0, error: "No workspace members found" };
      }

      // Find first member with GitHub token
      for (const member of members) {
        const { data: tokenData } = await supabase
          .from("github_oauth_tokens")
          .select("access_token")
          .eq("user_id", member.user_id)
          .single();

        if (tokenData?.access_token) {
          accessToken = tokenData.access_token;
          break;
        }
      }
    }

    if (!accessToken) {
      return {
        enqueued_count: 0,
        error: "No GitHub OAuth token available for backfill",
      };
    }

    // Fetch recent PRs from GitHub API
    const octokit = new Octokit({ auth: accessToken });

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const prs: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData } = await octokit.rest.pulls.list({
        owner: githubOwner,
        repo: githubRepo,
        state: "closed",
        since: sinceDate.toISOString(),
        per_page: 100,
        page,
      });

      if (pageData.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to merged PRs only
      prs.push(
        ...pageData.filter(
          (pr) => pr.merged_at && pr.merged_at !== null
        )
      );

      page++;
    }

    // Get repo record
    const { data: repoRecord, error: repoError } = await supabase
      .from("repos")
      .select("id, workspace_id")
      .eq("id", repoId)
      .single();

    if (repoError || !repoRecord) {
      return { enqueued_count: 0, error: "Repository not found" };
    }

    // Check if repo belongs to workspace
    if (repoRecord.workspace_id !== workspaceId) {
      return { enqueued_count: 0, error: "Repo not in workspace" };
    }

    // Transform GitHub PRs to our format and upsert
    const prRecords = prs.map((pr) => ({
      workspace_id: workspaceId,
      repo_id: repoId,
      github_pr_id: pr.id,
      pr_node_id: pr.node_id,
      title: pr.title,
      number: pr.number,
      url: pr.html_url,
      author_github_handle: pr.user.login,
      merged_at: pr.merged_at,
      additions_count: pr.additions,
      deletions_count: pr.deletions,
      files_changed_count: pr.changed_files,
    }));

    // Upsert PRs (no error if duplicate pr_node_id — TC-SCR-010 dedup)
    const { data: upsertedPRs, error: upsertError } = await supabase
      .from("pull_requests")
      .upsert(prRecords, {
        onConflict: "pr_node_id",
        ignoreDuplicates: true,
      })
      .select();

    if (upsertError) {
      console.error("Error upserting PRs:", upsertError);
      return { enqueued_count: 0, error: "Failed to enqueue PRs" };
    }

    const enqueuedCount = upsertedPRs?.length || 0;

    // Log backfill to audit
    await supabase.from("audit_log").insert({
      workspace_id: workspaceId,
      action: "backfill_completed",
      subject_type: "repo",
      subject_id: repoId,
      details: {
        owner: githubOwner,
        repo: githubRepo,
        days_back: daysBack,
        fetched_count: prs.length,
        enqueued_count: enqueuedCount,
      },
    });

    return { enqueued_count: enqueuedCount };
  } catch (error) {
    console.error("Backfill error:", error);
    return {
      enqueued_count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Backfill PRs for a developer (Phase 2.5: dev invite)
 * Fetches PRs authored by the developer across all workspace repos
 */
export async function backfillDeveloperPRs(
  workspaceId: string,
  userId: string,
  daysBack: number = 90
): Promise<{ enqueued_count: number; error?: string }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get developer's GitHub OAuth token
    const { data: tokenData, error: tokenError } = await supabase
      .from("github_oauth_tokens")
      .select("access_token, github_handle")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenData?.access_token) {
      return {
        enqueued_count: 0,
        error: "Developer GitHub account not linked",
      };
    }

    // Get all repos in workspace
    const { data: repos, error: reposError } = await supabase
      .from("repos")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (reposError || !repos) {
      return { enqueued_count: 0, error: "Failed to fetch repos" };
    }

    let totalEnqueued = 0;

    // Backfill PRs for each repo
    for (const repo of repos) {
      const result = await backfillRepositoryPRs(
        workspaceId,
        repo.id,
        repo.owner,
        repo.name,
        daysBack,
        tokenData.access_token
      );

      totalEnqueued += result.enqueued_count;
    }

    // Mark PRs authored by this developer
    await supabase
      .from("pull_requests")
      .update({
        author_user_id: userId,
      })
      .eq("workspace_id", workspaceId)
      .eq("author_github_handle", tokenData.github_handle);

    return { enqueued_count: totalEnqueued };
  } catch (error) {
    console.error("Developer backfill error:", error);
    return {
      enqueued_count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
