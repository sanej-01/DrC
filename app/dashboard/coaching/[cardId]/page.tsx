'use client';

/**
 * Coaching Card Detail Page — Phase 5.3
 * Full-page view of a single coaching card with all related feedback
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import CoachingCardDetailView from '@/components/dashboard/CoachingCardDetailView';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface CoachingCard {
  id: string;
  pr_id: string;
  pr_number: number;
  dimension: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  file_path?: string;
  line_number?: number;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  pr_id: string;
  dimension: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  file_path?: string;
  line_number?: number;
}

export default function CoachingCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;

  const [card, setCard] = useState<CoachingCard | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCoachingCardDetail();
  }, [cardId]);

  async function loadCoachingCardDetail() {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Get coaching card
      const { data: cardData, error: cardError } = await supabase
        .from('coaching_cards')
        .select('*')
        .eq('id', cardId)
        .single();

      if (cardError || !cardData) {
        setError('Coaching card not found');
        setLoading(false);
        return;
      }

      setCard(cardData);

      // Get related feedback items for this PR
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('scoring_feedback')
        .select('*')
        .eq('pr_id', cardData.pr_id)
        .order('created_at', { ascending: false });

      if (!feedbackError && feedbackData) {
        setFeedback(feedbackData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading coaching card:', err);
      setError('Failed to load coaching card');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading coaching details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:underline"
        >
          ← Back
        </button>
        <div className="flex items-center justify-center h-96">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="space-y-4 py-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:underline"
        >
          ← Back
        </button>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">No coaching card found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <button
        onClick={() => router.back()}
        className="text-blue-600 hover:underline mb-6 font-medium"
      >
        ← Back to Dashboard
      </button>

      <CoachingCardDetailView card={card} feedbackItems={feedback} />
    </div>
  );
}
