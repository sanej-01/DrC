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

        // GitHub's "list pull requests" endpoint (used above) doesn't
        // include additions/deletions/changed_files - those only exist
        // on the "get a single pull request" response. Fetch it so the
        // stored stats (and the scoring triage step, which skips PRs it
        // thinks have 0 files changed) reflect reality.
        let additions = pr.additions;
        let deletions = pr.deletions;
        let changedFiles = pr.changed_files;
        let mergeCommitSha = pr.merge_commit_sha;
        try {
          const { data: fullPr } = await octokit.rest.pulls.get({
            owner: githubOwner,
            repo: githubRepo,
            pull_number: pr.number,
          });
          additions = fullPr.additions;
          deletions = fullPr.deletions;
          changedFiles = fullPr.changed_files;
          mergeCommitSha = fullPr.merge_commit_sha;
        } catch (detailError) {
          console.warn(`Failed to fetch full PR details for #${pr.number}:`, detailError);
          // Fall back to whatever the list response had (likely undefined)
        }

        const developerId = await resolveDeveloperId(supabase, workspaceId, pr.user.login);

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
            developer_id: developerId,
            merged_at: pr.merged_at,
            additions_count: additions,
            deletions_count: deletions,
            files_changed_count: changedFiles,
            merge_commit_sha: mergeCommitSha,
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

    // Cover activity that never went through a tracked PR at all - a
    // direct push to main, or a branch merged locally with `git merge`
    // instead of GitHub's "Open a pull request" flow. Runs regardless
    // of whether this repo also has real PRs, since PR coverage can be
    // partial (some branches merged properly, others not).
    await enqueueGeneralHistoryFallback(
      supabase,
      octokit,
      workspaceId,
      repoId,
      githubOwner,
      githubRepo,
      result
    );

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
 * Look up which developer a GitHub handle belongs to, via the
 * durable workspace_members.github_handle mapping (set once when a
 * developer's account is linked, not per-scan). Returns null if the
 * handle isn't recognized in this workspace (e.g. an external
 * contributor, or a developer who hasn't set their GitHub handle yet).
 */
async function resolveDeveloperId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  githubHandle: string | undefined | null
): Promise<string | null> {
  if (!githubHandle) return null;
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("github_handle", githubHandle)
    .maybeSingle();
  return data?.user_id || null;
}

const GENERAL_REVIEW_LOOKBACK_DAYS = 90;

/**
 * Fallback for commit activity that no tracked PR accounts for -
 * direct pushes to main, or a branch merged locally with `git merge`
 * instead of GitHub's "Open a pull request" flow. This runs on every
 * scan (not just when a repo has zero PRs total), since PR coverage
 * can be partial: a repo can have some real, trackable PRs and still
 * have other merges that never went through one.
 *
 * A PR's merge_commit_sha is the commit it produced on the base
 * branch, so commits already covered by a tracked PR are excluded by
 * comparing against every merge_commit_sha already stored for this
 * repo. What's left is summarized as one synthetic pull_requests row
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

    const { data: allCommits } = await octokit.rest.repos.listCommits({
      owner: githubOwner,
      repo: githubRepo,
      since: since.toISOString(),
      per_page: 100,
    });

    if (!allCommits || allCommits.length === 0) {
      return; // Nothing pushed in the lookback window either
    }

    const { data: trackedPrs } = await supabase
      .from("pull_requests")
      .select("merge_commit_sha")
      .eq("repo_id", repoId)
      .not("merge_commit_sha", "is", null);

    const trackedShas = new Set(
      (trackedPrs || []).map((p: { merge_commit_sha: string }) => p.merge_commit_sha)
    );

    const commits = allCommits.filter((c) => !trackedShas.has(c.sha));

    if (commits.length === 0) {
      return; // Every recent commit is already covered by a tracked PR
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

    const developerId = await resolveDeveloperId(supabase, workspaceId, authorHandle);

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
      developer_id: developerId,
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

    // Active repos only, oldest first so the first row is the primary
    // project. A workspace supports up to 5 connected projects; the
    // first is required, the rest optional.
    const { data: repos, error: reposError } = await supabase
      .from("repos")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(5);

    if (reposError || !repos) {
      console.error("Error fetching repos:", reposError);
      return [];
    }

    const octokit = new Octokit({ auth: userGitHubToken });

    // Poll each repo
    const results: PollerResult[] = [];
    for (const [index, repo] of repos.entries()) {
      // Refresh repo metadata from GitHub so renames propagate, and use
      // the primary project's GitHub name as the workspace's team name.
      try {
        const { data: ghRepo } = await octokit.rest.repos.get({
          owner: repo.owner,
          repo: repo.name,
        });
        await supabase
          .from("repos")
          .update({
            owner: ghRepo.owner.login,
            name: ghRepo.name,
            full_name: ghRepo.full_name,
            description: ghRepo.description,
            url: ghRepo.html_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", repo.id);
        if (index === 0) {
          await supabase
            .from("workspaces")
            .update({ name: ghRepo.name, updated_at: new Date().toISOString() })
            .eq("id", workspaceId);
        }
        // Keep the loop variables current for the poll below
        repo.owner = ghRepo.owner.login;
        repo.name = ghRepo.name;
      } catch (metaError) {
        // Metadata refresh is best-effort; a rename/permissions hiccup
        // shouldn't block PR polling with the stored coordinates.
        console.warn(
          `Could not refresh metadata for ${repo.owner}/${repo.name}:`,
          extractErrorMessage(metaError)
        );
      }

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
