import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPRDiff } from "@/lib/github-client";
import { routeAndScorePR } from "@/lib/score-router";
import {
  classifyError,
  handleScoringFailure,
  createManagerAlert,
  DEFAULT_RETRY_CONFIG,
} from "@/lib/retry-logic";
import { updateAggregatesForPR } from "@/lib/aggregates";
import { checkDailyCapAndScore, logCost, COST_PER_PR_CENTS } from "@/lib/spend-guardrail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/scoring/score-pr
 * Score a single PR from the queue
 * Phase 4.1-4.2: Haiku triage → Sonnet scoring
 *
 * Body: { pr_id: UUID }
 *
 * Returns:
 * - pr_scores: { code_quality, bug_risk, architecture, test_coverage }
 * - feedback_items: [ { type, dimension, title, description, ... } ]
 * - audit: { model_version, tokens, latency, cost }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pr_id } = body;

    if (!pr_id) {
      return NextResponse.json({ error: "pr_id required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get PR from database
    const { data: pr, error: prError } = await supabase
      .from("pull_requests")
      .select("*")
      .eq("id", pr_id)
      .single();

    if (prError || !pr) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    // Phase 4.5: Check spend guardrail before scoring
    const capCheck = await checkDailyCapAndScore(supabase, pr.workspace_id, COST_PER_PR_CENTS);
    if (!capCheck.can_score) {
      return NextResponse.json(
        {
          error: "Daily cost cap reached",
          reason: capCheck.reason,
          cost_status: capCheck.cost_status,
        },
        { status: 429 } // Too Many Requests (cost limit)
      );
    }

    // Update queue status to "scoring"
    await supabase.from("scoring_queue").update({ status: "scoring" }).eq("pr_id", pr_id);

    try {
      // Fetch PR diff (in-memory only)
      let diff = "";
      try {
        diff = await getPRDiff(pr.author_github_handle.split("/")[0], pr.repo_id, pr.number);
      } catch (diffError) {
        console.warn("Failed to fetch diff:", diffError);
        // Continue with empty diff if fetch fails
      }

      // Route and score PR (Haiku triage → Sonnet scoring)
      const { result, audit } = await routeAndScorePR(
        pr.number,
        pr.title,
        pr.author_github_handle,
        pr.files_changed_count,
        pr.additions_count,
        pr.deletions_count,
        diff
      );

      // Store scores in pr_scores table
      const { error: scoreError } = await supabase.from("pr_scores").insert({
        pr_id: pr_id,
        code_quality: result.code_quality,
        bug_risk: result.bug_risk,
        architecture: result.architecture,
        test_coverage: result.test_coverage,
        scored_at: new Date().toISOString(),
      });

      if (scoreError) {
        throw scoreError;
      }

      // Store feedback items
      if (result.feedback && result.feedback.length > 0) {
        const feedbackItems = result.feedback.map((f) => ({
          pr_id: pr_id,
          feedback_type: f.type,
          dimension: f.dimension,
          title: f.title,
          description: f.description,
          severity: f.severity,
          file_path: f.file_path,
          line_number: f.line_number,
        }));

        const { error: feedbackError } = await supabase
          .from("scoring_feedback")
          .insert(feedbackItems);

        if (feedbackError) {
          console.error("Error storing feedback:", feedbackError);
          // Don't fail if feedback storage fails
        }
      }

      // Store audit entry
      const { error: auditError } = await supabase.from("scoring_audit").insert({
        workspace_id: pr.workspace_id,
        pr_id: pr_id,
        ...audit,
      });

      if (auditError) {
        console.error("Error storing audit:", auditError);
        // Don't fail if audit storage fails
      }

      // Update queue status to "completed"
      await supabase
        .from("scoring_queue")
        .update({ status: "completed", scored_at: new Date().toISOString() })
        .eq("pr_id", pr_id);

      // Phase 4.4: Update aggregates for developer
      await updateAggregatesForPR(supabase, pr.workspace_id, pr_id);

      // Phase 4.5: Log cost
      await logCost(
        supabase,
        pr.workspace_id,
        pr_id,
        "score",
        audit.scoring_model,
        audit.scoring_tokens_input,
        audit.scoring_tokens_output,
        audit.estimated_cost_cents
      );

      // Log to audit_log
      await supabase.from("audit_log").insert({
        workspace_id: pr.workspace_id,
        action: "pr_scored",
        subject_type: "pr",
        subject_id: pr_id,
        details: {
          pr_number: pr.number,
          scores: {
            code_quality: result.code_quality,
            bug_risk: result.bug_risk,
            architecture: result.architecture,
            test_coverage: result.test_coverage,
          },
          triage_model: audit.triage_model,
          scoring_model: audit.scoring_model,
          total_tokens: audit.triage_tokens_input +
            audit.triage_tokens_output +
            audit.scoring_tokens_input +
            audit.scoring_tokens_output,
          cost_cents: audit.estimated_cost_cents,
        },
      });

      return NextResponse.json({
        status: "scored",
        pr_id: pr_id,
        scores: {
          code_quality: result.code_quality,
          bug_risk: result.bug_risk,
          architecture: result.architecture,
          test_coverage: result.test_coverage,
        },
        audit: {
          triage_model: audit.triage_model,
          scoring_model: audit.scoring_model,
          total_latency_ms: audit.total_latency_ms,
          estimated_cost_cents: audit.estimated_cost_cents,
        },
      });
    } catch (scoringError) {
      // Phase 4.3: Retry fallback — classify error and decide retry strategy
      const errorMessage = scoringError instanceof Error ? scoringError.message : "Unknown error";
      const errorType = classifyError(scoringError);

      const { data: queueEntry } = await supabase
        .from("scoring_queue")
        .select("attempted_count")
        .eq("pr_id", pr_id)
        .single();

      const currentAttempt = (queueEntry?.attempted_count || 0) + 1;

      // Handle failure and decide retry/alert
      const failureResult = await handleScoringFailure({
        pr_id: pr_id,
        pr_number: pr.number,
        workspace_id: pr.workspace_id,
        error_type: errorType,
        error_message: errorMessage,
        attempt: currentAttempt,
        max_attempts: DEFAULT_RETRY_CONFIG.max_attempts,
        should_retry: false, // Placeholder, will be determined by handleScoringFailure
      });

      // If permanent failure, alert manager
      if (failureResult.alert_manager) {
        await createManagerAlert(
          pr.workspace_id,
          pr_id,
          pr.number,
          errorType,
          errorMessage
        );

        return NextResponse.json(
          {
            error: "Scoring failed after max attempts",
            pr_id: pr_id,
            attempts: currentAttempt,
            error_type: errorType,
            manager_alerted: true,
          },
          { status: 500 }
        );
      } else if (failureResult.will_retry) {
        // Will retry — return with retry info
        return NextResponse.json(
          {
            error: "Scoring failed, will retry",
            pr_id: pr_id,
            attempts: currentAttempt,
            max_attempts: DEFAULT_RETRY_CONFIG.max_attempts,
            error_type: errorType,
            next_retry_ms: failureResult.next_retry_ms,
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error("Scoring endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
