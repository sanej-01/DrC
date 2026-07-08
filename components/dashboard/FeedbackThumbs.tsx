'use client';

/**
 * FeedbackThumbs — Phase 5.4
 * Thumbs up/down voting on coaching feedback (idempotent)
 * Integrates with feedback-votes library
 */

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { voteOnCoachingCard, getUserVote, getVoteSummary, getHelpfulnessLabel } from '@/lib/feedback-votes';

interface FeedbackThumbsProps {
  coaching_card_id: string;
  compact?: boolean; // Compact mode for modal vs full mode for detail page
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default function FeedbackThumbs({
  coaching_card_id,
  compact = false,
}: FeedbackThumbsProps) {
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVotes();
  }, [coaching_card_id]);

  async function loadVotes() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Load user's vote
    const vote = await getUserVote(supabase, coaching_card_id);
    setUserVote(vote?.helpful || null);

    // Load vote summary
    const voteSummary = await getVoteSummary(supabase, coaching_card_id);
    setSummary(voteSummary);

    setLoading(false);
  }

  async function handleVote(helpful: boolean) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // If clicking same vote, toggle off (remove vote)
    const newVote = userVote === helpful ? null : helpful;

    if (newVote === null) {
      // Remove vote
      const { removeVote } = await import('@/lib/feedback-votes');
      await removeVote(supabase, coaching_card_id);
      setUserVote(null);
    } else {
      // Vote
      await voteOnCoachingCard(supabase, coaching_card_id, newVote);
      setUserVote(newVote);
    }

    // Reload summary
    const voteSummary = await getVoteSummary(supabase, coaching_card_id);
    setSummary(voteSummary);
  }

  if (loading) {
    return <div className="text-gray-400 text-sm">...</div>;
  }

  if (compact) {
    // Compact mode for modal
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/30">
        <span className="text-xs text-gray-600">Was this helpful?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVote(true)}
            className={`px-2 py-1 rounded text-sm font-medium transition-all ${
              userVote === true
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            👍
          </button>
          <button
            onClick={() => handleVote(false)}
            className={`px-2 py-1 rounded text-sm font-medium transition-all ${
              userVote === false
                ? 'bg-red-100 text-red-700 border border-red-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            👎
          </button>
        </div>
        {summary && (
          <span className="text-xs text-gray-500 ml-2">
            {getHelpfulnessLabel(summary)}
          </span>
        )}
      </div>
    );
  }

  // Full mode for detail page
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
      <h3 className="font-semibold text-blue-900 mb-4">Was this feedback helpful?</h3>

      <div className="flex items-center gap-4">
        {/* Thumbs up button */}
        <button
          onClick={() => handleVote(true)}
          className={`flex flex-col items-center gap-2 px-6 py-4 rounded-lg transition-all ${
            userVote === true
              ? 'bg-green-200 border-2 border-green-500 shadow-lg'
              : 'bg-white border border-gray-300 hover:border-green-500 hover:shadow'
          }`}
        >
          <span className="text-3xl">👍</span>
          <span className={`text-sm font-medium ${
            userVote === true ? 'text-green-700' : 'text-gray-700'
          }`}>
            Yes, helpful
          </span>
        </button>

        {/* Thumbs down button */}
        <button
          onClick={() => handleVote(false)}
          className={`flex flex-col items-center gap-2 px-6 py-4 rounded-lg transition-all ${
            userVote === false
              ? 'bg-red-200 border-2 border-red-500 shadow-lg'
              : 'bg-white border border-gray-300 hover:border-red-500 hover:shadow'
          }`}
        >
          <span className="text-3xl">👎</span>
          <span className={`text-sm font-medium ${
            userVote === false ? 'text-red-700' : 'text-gray-700'
          }`}>
            Not helpful
          </span>
        </button>

        {/* Vote summary */}
        <div className="flex-1 pl-4 border-l border-blue-300">
          <p className="text-sm text-blue-900 font-medium mb-2">Community feedback</p>
          {summary && summary.total_votes > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full overflow-hidden h-2">
                  <div
                    className="bg-green-500 h-full transition-all"
                    style={{
                      width: `${summary.helpful_percentage || 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-blue-900 w-12 text-right">
                  {summary.helpful_percentage || 0}%
                </span>
              </div>
              <p className="text-xs text-blue-700">
                👍 {summary.helpful_count} helpful • 👎 {summary.unhelpful_count} not helpful
              </p>
            </>
          ) : (
            <p className="text-xs text-blue-600 italic">No votes yet — be the first!</p>
          )}
        </div>
      </div>

      {userVote !== null && (
        <p className="text-xs text-blue-700 mt-4 font-medium">
          ✓ Your vote: {userVote ? '👍 Helpful' : '👎 Not helpful'} (click again to remove)
        </p>
      )}
    </div>
  );
}
