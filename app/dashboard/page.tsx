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

      // Live schema has no separate pr_aggregates/coaching_cards tables
      // (see supabase/seeds/create-poller-tables.sql) - both the 30-day
      // score and coaching quests are derived here from pull_requests +
      // pr_scores directly, same approach used by garden-stats and the
      // manager individual-stats route.
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

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
          pr_scores(code_quality, bug_risk, architecture, test_coverage, feedback)
        `
        )
        .eq('workspace_id', membership.workspace_id)
        .eq('developer_id', user.id)
        .order('merged_at', { ascending: false })
        .limit(20);

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

        const withinLast30d = formatted.filter(
          (pr) => pr.scores && pr.merged_at >= thirtyDaysAgo
        );
        const count = withinLast30d.length;

        if (count > 0) {
          const avg = (key: 'code_quality' | 'bug_risk' | 'architecture' | 'test_coverage') =>
            withinLast30d.reduce((sum, pr) => sum + (pr.scores![key] || 0), 0) / count;

          const quality = avg('code_quality');
          const bugRisk = avg('bug_risk');
          const architecture = avg('architecture');
          const testCoverage = avg('test_coverage');
          const overall =
            (quality + (100 - bugRisk) + architecture + testCoverage) / 4;

          setStats({
            avg_code_quality: quality,
            avg_bug_risk: bugRisk,
            avg_architecture: architecture,
            avg_test_coverage: testCoverage,
            overall_score: Math.round(overall * 10) / 10,
            confidence_badge: count >= 3 ? 'CONFIDENT' : 'LOW_CONFIDENCE',
            score_count_30d: count,
          });
        } else {
          setStats({
            avg_code_quality: null,
            avg_bug_risk: null,
            avg_architecture: null,
            avg_test_coverage: null,
            overall_score: 0,
            confidence_badge: 'LOW_CONFIDENCE',
            score_count_30d: 0,
          });
        }

        // Coaching quests = the feedback items already stored per PR
        // score, flattened across recent PRs (most recent first).
        const quests = formatted
          .flatMap((pr) =>
            (pr.scores?.feedback || []).map((item: any, idx: number) => ({
              id: `${pr.id}-${idx}`,
              pr_number: pr.number,
              dimension: item.dimension,
              title: item.title,
              description: item.description,
              severity: item.type,
              file_path: item.file_path,
              line_number: item.line_number,
            }))
          )
          .slice(0, 5);
        setCoaches(quests);
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
