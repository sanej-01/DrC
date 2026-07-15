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
import crypto from "crypto";

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

    const prs: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        // Note: the GitHub REST "list pull requests" endpoint has no
        // `since` parameter (that only exists on issues/commits list
        // endpoints) - closed PRs are paged through and filtered to
        // merged ones below instead.
        const { data: pageData } = await octokit.rest.pulls.list({
          owner: githubOwner,
          repo: githubRepo,
          state: "closed",
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
        // Surface this instead of only logging it server-side - a bad
        // token or inaccessible repo would otherwise look like a clean
        // scan that just happened to find 0 PRs.
        const message = extractErrorMessage(pageError);
        console.error(`Poller error fetching page ${page}:`, pageError);
        result.error = result.error ? `${result.error}; ${message}` : message;
        hasMore = false;
      }
    }

    result.prs_checked = prs.length;

    // No PR history at all for this repo - fall back to a general
    // commit-history-based review so there's still something to score
    // and show in PR Details, instead of the scan just reporting 0
    // forever for repos that never used GitHub's PR feature.
    if (prs.length === 0) {
      await enqueueGeneralHistoryFallback(
        supabase,
        octokit,
        workspaceId,
        repoId,
        githubOwner,
        githubRepo,
        result
      );
    }

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
          const message = extractErrorMessage(checkError);
          console.error("Error checking duplicate:", checkError);
          result.error = result.error ? `${result.error}; ${message}` : message;
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
            id: crypto.randomUUID(),
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
            const message = extractErrorMessage(insertError);
            console.error("Error inserting PR:", insertError);
            result.error = result.error ? `${result.error}; ${message}` : message;
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
        const message = extractErrorMessage(prError);
        console.error("Error processing PR:", prError);
        result.error = result.error ? `${result.error}; ${message}` : message;
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

const GENERAL_REVIEW_LOOKBACK_DAYS = 90;

/**
 * Fallback for repos with zero merged PRs (e.g. everything was pushed
 * directly to main, or merged without going through GitHub's PR
 * feature). Instead of the scan reporting 0 PRs forever, summarize the
 * last ~90 days of commit activity as one synthetic pull_requests row
 * so there's still something for score-prs to analyze and for the PR
 * Details section to display.
 *
 * Idempotent the same way real PRs are: pr_node_id is a stable string
 * derived from the repo (not random), so re-scanning finds the
 * existing row via the normal duplicate check and skips it, rather
 * than creating a new one every time.
 */
async function enqueueGeneralHistoryFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  octokit: Octokit,
  workspaceId: string,
  repoId: string,
  githubOwner: string,
  githubRepo: string,
  result: PollerResult
): Promise<void> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - GENERAL_REVIEW_LOOKBACK_DAYS);

    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: githubOwner,
      repo: githubRepo,
      since: since.toISOString(),
      per_page: 100,
    });

    if (!commits || commits.length === 0) {
      return; // Nothing pushed in the lookback window either
    }

    const pr_node_id = `general-review:${githubOwner}/${githubRepo}`;

    const { data: existing, error: checkError } = await supabase
      .from("pull_requests")
      .select("id")
      .eq("pr_node_id", pr_node_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      result.error = extractErrorMessage(checkError);
      return;
    }

    if (existing) {
      result.prs_duplicated++;
      return;
    }

    // Most frequent committer, or a generic label if activity is spread
    // across several people
    const authorCounts = new Map<string, number>();
    for (const commit of commits) {
      const author = commit.author?.login || commit.commit.author?.name || "unknown";
      authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    }
    const sortedAuthors = [...authorCounts.entries()].sort((a, b) => b[1] - a[1]);
    const authorHandle =
      sortedAuthors.length > 0 && sortedAuthors[0][1] >= commits.length / 2
        ? sortedAuthors[0][0]
        : "multiple-contributors";

    const mostRecentDate =
      commits[0]?.commit.author?.date || new Date().toISOString();

    const { error: insertError } = await supabase.from("pull_requests").insert({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      repo_id: repoId,
      github_pr_id: 0,
      pr_node_id,
      title: `No PR history — general review of ${commits.length} commit${commits.length === 1 ? "" : "s"} from the last ${GENERAL_REVIEW_LOOKBACK_DAYS} days`,
      number: 0,
      url: `https://github.com/${githubOwner}/${githubRepo}/commits`,
      author_github_handle: authorHandle,
      merged_at: mostRecentDate,
      additions_count: 0,
      deletions_count: 0,
      files_changed_count: 0,
    });

    if (insertError) {
      result.error = extractErrorMessage(insertError);
      return;
    }

    result.prs_enqueued++;
    result.prs_checked++;

    await supabase.from("audit_log").insert({
      workspace_id: workspaceId,
      action: "general_review_enqueued",
      subject_type: "pr",
      subject_id: pr_node_id,
      details: {
        commit_count: commits.length,
        lookback_days: GENERAL_REVIEW_LOOKBACK_DAYS,
        source: "poller",
      },
    });
  } catch (fallbackError) {
    result.error = extractErrorMessage(fallbackError);
  }
}

/**
 * Extract a readable message from any thrown value. Supabase/PostgREST
 * errors are plain objects with a `message` property, not real Error
 * instances, so `error instanceof Error` misses them and silently
 * loses the actual reason (e.g. "relation does not exist").
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Octokit's RequestError extends Error but carries the useful
    // diagnostic info (HTTP status, request URL, GitHub's own message)
    // as extra properties that `.message` alone doesn't show.
    const details = [error.message];
    const anyError = error as {
      status?: number;
      request?: { url?: string };
      response?: { data?: { message?: string } };
    };
    if (typeof anyError.status === "number") {
      details.push(`status=${anyError.status}`);
    }
    if (typeof anyError.request?.url === "string") {
      details.push(`url=${anyError.request.url}`);
    }
    if (
      typeof anyError.response?.data?.message === "string" &&
      anyError.response.data.message !== error.message
    ) {
      details.push(`github_message=${anyError.response.data.message}`);
    }
    return details.join(" | ");
  }
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
      // pull_requests.repo_id, poller_metadata.repo_id, and
      // poller_job_log.repo_id all have foreign keys to repos(id) -
      // not repos.repo_id, which is a separate, unrelated GitHub-side
      // identifier column with no FK relationships anywhere.
      const result = await pollRepositoryPRs(
        workspaceId,
        repo.id,
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
