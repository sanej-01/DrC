'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import GrowthRing from '@/components/dashboard/GrowthRing';
import DimensionTiles from '@/components/dashboard/DimensionTiles';
import Quests from '@/components/dashboard/Quests';
import PRTimeline from '@/components/dashboard/PRTimeline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface DeveloperStats {
  avg_code_quality: number | null;
  avg_bug_risk: number | null;
  avg_architecture: number | null;
  avg_test_coverage: number | null;
  overall_score: number;
  confidence_badge: 'LOW_CONFIDENCE' | 'CONFIDENT';
  score_count_30d: number;
}

interface CoachingCard {
  id: string;
  dimension: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  file_path?: string;
}

interface PR {
  id: string;
  number: number;
  title: string;
  created_at: string;
  merged_at: string;
  additions_count: number;
  deletions_count: number;
  files_changed_count: number;
  scores?: {
    code_quality: number;
    bug_risk: number;
    architecture: number;
    test_coverage: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DeveloperStats | null>(null);
  const [coaches, setCoaches] = useState<CoachingCard[]>([]);
  const [prs, setPRs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
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

      // Get user's workspace membership
      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        setError('No workspace membership');
        setLoading(false);
        return;
      }

      // Get aggregates (30-day window)
      const { data: aggs, error: aggError } = await supabase
        .from('pr_aggregates')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .eq('developer_id', user.id)
        .single();

      if (!aggError && aggs) {
        const overall =
          (aggs.avg_code_quality_30d || 0 +
            (100 - (aggs.avg_bug_risk_30d || 0)) +
            (aggs.avg_architecture_30d || 0) +
            (aggs.avg_test_coverage_30d || 0)) /
          4;

        setStats({
          avg_code_quality: aggs.avg_code_quality_30d,
          avg_bug_risk: aggs.avg_bug_risk_30d,
          avg_architecture: aggs.avg_architecture_30d,
          avg_test_coverage: aggs.avg_test_coverage_30d,
          overall_score: Math.round(overall * 10) / 10,
          confidence_badge: aggs.confidence_badge_30d,
          score_count_30d: aggs.score_count_30d,
        });
      }

      // Get coaching cards (quests)
      const { data: cards, error: cardError } = await supabase
        .from('coaching_cards')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .eq('about_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!cardError && cards) {
        setCoaches(cards);
      }

      // Get recent PRs with scores
      const { data: prList, error: prError } = await supabase
        .from('pull_requests')
        .select(
          `
          id,
          number,
          title,
          created_at,
          merged_at,
          additions_count,
          deletions_count,
          files_changed_count,
          pr_scores!inner(code_quality, bug_risk, architecture, test_coverage)
        `
        )
        .eq('workspace_id', membership.workspace_id)
        .eq('author_id', user.id)
        .order('merged_at', { ascending: false })
        .limit(10);

      if (!prError && prList) {
        const formatted = prList.map((pr: any) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          created_at: pr.created_at,
          merged_at: pr.merged_at,
          additions_count: pr.additions_count,
          deletions_count: pr.deletions_count,
          files_changed_count: pr.files_changed_count,
          scores: pr.pr_scores?.[0],
        }));
        setPRs(formatted);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading your growth data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Your Growth</h1>
        <p className="text-gray-600">
          30-day performance based on{' '}
          <span className="font-semibold">{stats?.score_count_30d || 0} PRs</span>
        </p>
        {stats?.confidence_badge === 'LOW_CONFIDENCE' && (
          <p className="text-sm text-amber-600">
            ⚠️ Low confidence — score more PRs for reliable insights
          </p>
        )}
      </div>

      {/* Growth Ring */}
      <div className="bg-white rounded-lg shadow-sm p-8 flex justify-center">
        <GrowthRing score={stats?.overall_score || 0} />
      </div>

      {/* Dimension Tiles */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Four Dimensions</h2>
        <DimensionTiles
          stats={{
            code_quality: stats?.avg_code_quality ?? null,
            bug_risk: stats?.avg_bug_risk ?? null,
            architecture: stats?.avg_architecture ?? null,
            test_coverage: stats?.avg_test_coverage ?? null,
          }}
          confidence={stats?.confidence_badge}
        />
      </div>

      {/* Quests / Coaching */}
      {coaches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Coaching Quests</h2>
          <Quests coaching_cards={coaches} />
        </div>
      )}

      {/* PR Timeline */}
      {prs.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent PRs</h2>
          <PRTimeline prs={prs} />
        </div>
      )}
    </div>
  );
}
