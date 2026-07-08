/**
 * Coach Panel Library (Phase 8.1)
 * Live "Ask Dr. Codium" model calls with RLS-safe context
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface CoachQuestion {
  id: string;
  workspace_id: string;
  user_id: string;
  subject_developer_id?: string;
  question: string;
  response?: string;
  model_name?: string;
  tokens_used?: number;
  latency_ms?: number;
  status: "pending" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

/**
 * Build RLS-safe context for coach query
 * For developers: only their own scores and coaching
 * For managers: team scores and coaching
 */
export async function buildCoachContext(
  supabase: SupabaseClient,
  workspaceId: string,
  developerId: string,
  userRole: string
): Promise<string> {
  // Fetch developer's recent PRs and scores
  const { data: prs } = await supabase
    .from("pull_requests")
    .select(
      `
      pr_number,
      merged_at,
      pr_scores (
        code_quality,
        bug_risk,
        architecture,
        test_coverage
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("developer_id", developerId)
    .order("merged_at", { ascending: false })
    .limit(5);

  // Fetch recent coaching cards
  const { data: coaching } = await supabase
    .from("coaching_cards")
    .select("severity, dimension, title, description")
    .eq("workspace_id", workspaceId)
    .in(
      "pr_id",
      (prs || []).map((p: any) => p.id)
    )
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch aggregates
  const { data: agg } = await supabase
    .from("pr_aggregates")
    .select(
      "avg_code_quality_30d, avg_bug_risk_30d, avg_architecture_30d, avg_test_coverage_30d, score_count_30d, confidence_badge_30d"
    )
    .eq("workspace_id", workspaceId)
    .eq("developer_id", developerId)
    .single();

  // Build context string (no raw diffs, only aggregated data)
  let context = `Developer Performance Context:\n`;
  context += `\n30-Day Aggregates:\n`;
  if (agg) {
    context += `- Code Quality: ${agg.avg_code_quality_30d?.toFixed(1) || "N/A"}\n`;
    context += `- Bug Risk (inverted): ${(100 - (agg.avg_bug_risk_30d || 0)).toFixed(1)}\n`;
    context += `- Architecture: ${agg.avg_architecture_30d?.toFixed(1) || "N/A"}\n`;
    context += `- Test Coverage: ${agg.avg_test_coverage_30d?.toFixed(1) || "N/A"}\n`;
    context += `- PR Count: ${agg.score_count_30d || 0}\n`;
    context += `- Confidence: ${agg.confidence_badge_30d || "LOW_CONFIDENCE"}\n`;
  }

  context += `\nRecent PRs (5 most recent):\n`;
  if (prs && prs.length > 0) {
    prs.forEach((pr: any, idx: number) => {
      const score = pr.pr_scores?.[0];
      const overall = score
        ? Math.round(
            (score.code_quality +
              (100 - score.bug_risk) +
              score.architecture +
              score.test_coverage) /
              4
          )
        : "N/A";
      context += `${idx + 1}. PR #${pr.pr_number} (${new Date(pr.merged_at).toLocaleDateString()}) - Score: ${overall}\n`;
    });
  }

  context += `\nRecent Coaching Feedback:\n`;
  if (coaching && coaching.length > 0) {
    const counts: Record<string, number> = {};
    (coaching as any[]).forEach((c) => {
      const key = c.severity;
      counts[key] = (counts[key] || 0) + 1;
    });
    Object.entries(counts).forEach(([severity, count]) => {
      context += `- ${severity}: ${count} items\n`;
    });
  }

  return context;
}

/**
 * Get developer's coach question history
 */
export async function getCoachHistory(
  supabase: SupabaseClient,
  workspaceId: string,
  developerId: string,
  limit: number = 20
): Promise<CoachQuestion[]> {
  const { data, error } = await supabase
    .from("coach_questions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", developerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data as CoachQuestion[];
}

/**
 * Create coach question
 */
export async function createCoachQuestion(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  subjectDeveloperId: string,
  question: string
): Promise<CoachQuestion> {
  if (!question.trim()) {
    throw new Error("Question cannot be empty");
  }

  if (question.length > 1000) {
    throw new Error("Question cannot exceed 1000 characters");
  }

  const { data, error } = await supabase
    .from("coach_questions")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      subject_developer_id: subjectDeveloperId,
      question,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;

  return data as CoachQuestion;
}

/**
 * Update coach response (called from API after model call)
 */
export async function updateCoachResponse(
  supabase: SupabaseClient,
  questionId: string,
  response: string,
  modelName: string,
  tokensUsed: number,
  latencyMs: number
): Promise<CoachQuestion> {
  const { data, error } = await supabase
    .from("coach_questions")
    .update({
      response,
      model_name: modelName,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;

  return data as CoachQuestion;
}

/**
 * Mark question as failed
 */
export async function markQuestionFailed(
  supabase: SupabaseClient,
  questionId: string,
  error: string
): Promise<CoachQuestion> {
  const { data, err } = await supabase
    .from("coach_questions")
    .update({
      status: "failed",
      error_message: error,
      completed_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .select()
    .single();

  if (err) throw err;

  return data as CoachQuestion;
}

/**
 * Build coaching system prompt
 * Guides the model to give helpful, safe feedback
 */
export function getCoachSystemPrompt(): string {
  return `You are Dr. Codium, an expert code review coach helping developers improve their craft.

Your role:
- Analyze developer performance metrics and coaching feedback
- Provide constructive, actionable guidance
- Celebrate strengths, address growth areas
- Stay grounded in data (scores, PR history)
- Keep responses concise (under 500 words)

Safety guidelines:
- Never make up or exaggerate scores
- Only reference data provided in context
- Don't suggest changes beyond the developer's control
- Respect privacy: only discuss provided metrics and feedback
- Focus on growth, not criticism`;
}

/**
 * Validate question is appropriate for coaching
 */
export function isValidCoachQuestion(question: string): boolean {
  // Reject questions about other users' performance (privacy)
  const privateTerms = ["other developer", "another person", "teammate's", "colleague's"];
  const lowerQuestion = question.toLowerCase();

  for (const term of privateTerms) {
    if (lowerQuestion.includes(term)) {
      return false;
    }
  }

  // Reject harmful requests
  const harmfulTerms = ["delete", "drop table", "password", "token", "secret"];
  for (const term of harmfulTerms) {
    if (lowerQuestion.includes(term)) {
      return false;
    }
  }

  return true;
}
