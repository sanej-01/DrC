/**
 * GitHub PR Poller
 * Phase 3.5: Vercel Cron job that polls GitHub every 5 minutes for missed webhooks
 * Fallback mechanism for webhook ingestion
 *
 * Key properties:
 * - Idempotent: dedup by pr_node_id (same as webhook)
 * - Efficient: tracks last_fetched_pr_id to avoid re-polling
 * - Observable: logs all polling activity
 * - Resilient: continues on errors, retries on next poll
 */

import { createClient } from "@supabase/supabase-js";
import { Octokit } from "octokit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface PollerResult {
  workspace_id: string;
  repo_id: string;
  prs_checked: number;
  prs_enqueued: number;
  prs_duplicated: number;
  error?: string;
}

/**
 * Poll a single repository for merged PRs
 * TC-ING-003 (poller part): Missed webhook recovered, dedup-safe
 */
export async function pollRepositoryPRs(
  workspaceId: string,
  repoId: string,
  githubOwner: string,
  githubRepo: string,
  userGitHubToken: string
): Promise<PollerResult> {
  const result: PollerResult = {
    workspace_id: workspaceId,
    repo_id: repoId,
    prs_checked: 0,
    prs_enqueued: 0,
    prs_duplicated: 0,
  };

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // Get poller metadata for this repo
    const { data: pollerData, error: pollerError } = await supabase
      .from("poller_metadata")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("repo_id", repoId)
      .single();

    if (pollerError && pollerError.code !== "PGRST116") {
      throw pollerError;
    }

    // Initialize poller metadata if not exists
    if (!pollerData) {
      await supabase.from("poller_metadata").insert({
        workspace_id: workspaceId,
        repo_id: repoId,
        status: "idle",
        next_poll_at: new Date().toISOString(),
      });
    }

    // Update status to polling
    await supabase
      .from("poller_metadata")
      .update({ status: "polling" })
      .eq("workspace_id", workspaceId)
      .eq("repo_id", repoId);

    // Fetch recent merged PRs from GitHub
    const octokit = new Octokit({ auth: userGitHubToken });

    // Poll for PRs created in last 24 hours (more frequent than backfill)
    const since24hAgo = new Date();
    since24hAgo.setHours(since24hAgo.getHours() - 24);

    const prs: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const { data: pageData } = await octokit.rest.pulls.list({
          owner: githubOwner,
          repo: githubRepo,
          state: "closed",
          since: since24hAgo.toISOString(),
          per_page: 100,
          page,
        });

        if (pageData.length === 0) {
          hasMore = false;
          break;
        }

        // Filter to merged PRs only
        prs.push(...pageData.filter((pr) => pr.merged_at && pr.merged_at !== null));

        page++;
      } catch (pageError) {
        console.error(`Poller error fetching page ${page}:`, pageError);
        // Continue with what we have
        hasMore = false;
      }
    }

    result.prs_checked = prs.length;

    // Check for duplicates and enqueue new PRs
    for (const pr of prs) {
      try {
        // Check if PR already exists
        const { data: existing, error: checkError } = await supabase
          .from("pull_requests")
          .select("id")
          .eq("pr_node_id", pr.node_id)
          .single();

        if (checkError && checkError.code !== "PGRST116") {
          console.error("Error checking duplicate:", checkError);
          continue;
        }

        if (existing) {
          // PR already enqueued (via webhook or prior poll)
          result.prs_duplicated++;
          continue;
        }

        // Enqueue new PR
        const { error: insertError } = await supabase
          .from("pull_requests")
          .insert({
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
          });

        if (insertError) {
          // Might be duplicate from concurrent webhook
          if (insertError.code === "23505") {
            result.prs_duplicated++;
          } else {
            console.error("Error inserting PR:", insertError);
          }
        } else {
          result.prs_enqueued++;

          // Log to audit
          await supabase.from("audit_log").insert({
            workspace_id: workspaceId,
            action: "pr_polled",
            subject_type: "pr",
            subject_id: pr.node_id,
            details: {
              pr_number: pr.number,
              source: "poller",
            },
          });
        }
      } catch (prError) {
        console.error("Error processing PR:", prError);
        continue;
      }
    }

    // Update poller metadata
    const nextPollTime = new Date();
    nextPollTime.setMinutes(nextPollTime.getMinutes() + 5);

    await supabase
      .from("poller_metadata")
      .update({
        status: "completed",
        last_poll_at: new Date().toISOString(),
        next_poll_at: nextPollTime.toISOString(),
        last_fetched_pr_id: prs.length > 0 ? prs[0].id : undefined,
      })
      .eq("workspace_id", workspaceId)
      .eq("repo_id", repoId);

    // Log to poller_job_log
    await supabase.from("poller_job_log").insert({
      workspace_id: workspaceId,
      repo_id: repoId,
      poll_completed_at: new Date().toISOString(),
      status: "success",
      prs_checked: result.prs_checked,
      prs_enqueued: result.prs_enqueued,
      prs_duplicated: result.prs_duplicated,
    });

    return result;
  } catch (error) {
    console.error("Poller error:", error);
    const errorMessage = extractErrorMessage(error);

    // Update metadata with error status
    try {
      await supabase
        .from("poller_metadata")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("workspace_id", workspaceId)
        .eq("repo_id", repoId);

      // Log failure
      await supabase.from("poller_job_log").insert({
        workspace_id: workspaceId,
        repo_id: repoId,
        poll_completed_at: new Date().toISOString(),
        status: "failed",
        error_message: errorMessage,
      });
    } catch (logError) {
      console.error("Error logging poller failure:", logError);
    }

    result.error = errorMessage;
    return result;
  }
}

/**
 * Extract a readable message from any thrown value. Supabase/PostgREST
 * errors are plain objects with a `message` property, not real Error
 * instances, so `error instanceof Error` misses them and silently
 * loses the actual reason (e.g. "relation does not exist").
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * Poll all repositories in a workspace
 * Called by Vercel Cron every 5 minutes
 */
export async function pollWorkspacePRs(
  workspaceId: string,
  userGitHubToken: string
): Promise<PollerResult[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get all repos in workspace
    const { data: repos, error: reposError } = await supabase
      .from("repos")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (reposError || !repos) {
      console.error("Error fetching repos:", reposError);
      return [];
    }

    // Poll each repo
    const results: PollerResult[] = [];
    for (const repo of repos) {
      const result = await pollRepositoryPRs(
        workspaceId,
        repo.repo_id,
        repo.owner,
        repo.name,
        userGitHubToken
      );
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error("Workspace poller error:", error);
    return [];
  }
}
