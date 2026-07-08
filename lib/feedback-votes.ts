/**
 * Feedback Votes — Phase 5.4
 * Idempotent voting on coaching feedback (thumbs up/down)
 */

export interface FeedbackVote {
  id: string;
  coaching_card_id: string;
  developer_id: string;
  helpful: boolean;
  voted_at: string;
}

export interface VoteSummary {
  coaching_card_id: string;
  helpful_count: number;
  unhelpful_count: number;
  total_votes: number;
  helpful_percentage: number | null;
}

/**
 * Vote on a coaching card (thumbs up/down)
 * Idempotent: can be called multiple times, last vote wins
 */
export async function voteOnCoachingCard(
  supabase: any,
  coaching_card_id: string,
  helpful: boolean
): Promise<FeedbackVote | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Not authenticated');
    return null;
  }

  // Upsert vote (idempotent)
  const { data, error } = await supabase
    .from('coaching_feedback_votes')
    .upsert({
      coaching_card_id,
      developer_id: user.id,
      helpful,
      voted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error voting on coaching card:', error);
    return null;
  }

  return data;
}

/**
 * Get current user's vote on a coaching card
 */
export async function getUserVote(
  supabase: any,
  coaching_card_id: string
): Promise<FeedbackVote | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from('coaching_feedback_votes')
    .select('*')
    .eq('coaching_card_id', coaching_card_id)
    .eq('developer_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected if not voted)
    console.error('Error fetching user vote:', error);
  }

  return data || null;
}

/**
 * Get vote summary for a coaching card
 */
export async function getVoteSummary(
  supabase: any,
  coaching_card_id: string
): Promise<VoteSummary | null> {
  const { data, error } = await supabase
    .from('coaching_card_vote_summary')
    .select('*')
    .eq('coaching_card_id', coaching_card_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching vote summary:', error);
  }

  return data || null;
}

/**
 * Remove a vote (developer can retract)
 */
export async function removeVote(
  supabase: any,
  coaching_card_id: string
): Promise<boolean> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  const { error } = await supabase
    .from('coaching_feedback_votes')
    .delete()
    .eq('coaching_card_id', coaching_card_id)
    .eq('developer_id', user.id);

  if (error) {
    console.error('Error removing vote:', error);
    return false;
  }

  return true;
}

/**
 * Get helpfulness percentage with formatting
 */
export function getHelpfulnessLabel(summary: VoteSummary | null): string {
  if (!summary || summary.total_votes === 0) {
    return 'No votes yet';
  }

  if (summary.helpful_percentage === null) {
    return `${summary.total_votes} vote${summary.total_votes === 1 ? '' : 's'}`;
  }

  return `${summary.helpful_percentage}% helpful (${summary.total_votes} vote${summary.total_votes === 1 ? '' : 's'})`;
}
