'use client';

/**
 * Manager Individual Developer Detail — Phase 6.2
 * Drill-down view with 90-day trajectory, PR heat, and coaching history
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DeveloperTrajectory from '@/components/manager/DeveloperTrajectory';
import PRHeatMap from '@/components/manager/PRHeatMap';
import CoachingHistory from '@/components/manager/CoachingHistory';
import ManagerNoteEditor from '@/components/manager/ManagerNoteEditor';

interface Developer {
  id: string;
  display_name: string;
  email: string;
  github_handle?: string;
}

interface IndividualStats {
  developer: Developer;
  trajectory: {
    score_90d: number | null;
    score_60d: number | null;
    score_30d: number | null;
    pr_count_90d: number;
    pr_count_60d: number;
    pr_count_30d: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  coaching: {
    total: number;
    breakdown: {
      GOOD: number;
      IMPROVE: number;
      FIX: number;
      SUGGEST: number;
    };
  };
  recent_prs: Array<{
    id: string;
    pr_number: number;
    title: string;
    merged_at: string;
    score: number | null;
    dimensions: {
      quality: number | null;
      bug_risk: number | null;
      architecture: number | null;
      tests: number | null;
    } | null;
  }>;
  aggregates: {
    confidence_30d: string;
    confidence_60d: string;
    confidence_90d: string;
  } | null;
}

export default function IndividualDeveloperPage() {
  const params = useParams();
  const router = useRouter();
  const developerId = params.developerId as string;

  const [stats, setStats] = useState<IndividualStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const wid = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : ''
        ).get('workspace_id');

        if (!wid) {
          setError('No workspace selected');
          return;
        }

        setWorkspaceId(wid);

        const response = await fetch(
          `/api/manager/team/${developerId}/individual-stats?workspace_id=${wid}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch developer stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load developer stats'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [developerId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to team
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error loading developer</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const dev = stats.developer;
  const currentScore = stats.trajectory.score_30d;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 font-medium mb-4"
        >
          ← Back to team
        </button>

        <div className="flex items-end gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {dev.display_name}
            </h1>
            {dev.github_handle && (
              <p className="text-gray-600 mt-1">@{dev.github_handle}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">{dev.email}</p>
          </div>

          {/* Current score card */}
          {currentScore !== null && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 text-center">
              <div className="text-sm text-gray-600 mb-2">30-Day Score</div>
              <div className="text-4xl font-bold text-gray-900">
                {currentScore}
              </div>
              <div className="text-xs text-gray-600 mt-2">/100</div>
              {stats.aggregates && (
                <div className="mt-3 text-xs">
                  {stats.aggregates.confidence_30d === 'CONFIDENT' ? (
                    <span className="text-green-700 font-semibold">
                      ✓ Confident
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold">
                      ⚠️ Low confidence (&lt; 3 PRs)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 90-day trajectory */}
        <DeveloperTrajectory trajectory={stats.trajectory} />

        {/* Quick stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Quick Stats
          </h2>

          <div className="space-y-4">
            {/* PR count */}
            <div className="pb-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                PR Activity
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last 30 days</span>
                  <span className="font-semibold text-gray-900">
                    {stats.trajectory.pr_count_30d} PRs
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last 60 days</span>
                  <span className="font-semibold text-gray-900">
                    {stats.trajectory.pr_count_60d} PRs
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last 90 days</span>
                  <span className="font-semibold text-gray-900">
                    {stats.trajectory.pr_count_90d} PRs
                  </span>
                </div>
              </div>
            </div>

            {/* Coaching summary */}
            <div className="pb-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Coaching Feedback
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Well Done</span>
                  <span className="font-semibold text-green-700">
                    {stats.coaching.breakdown.GOOD}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Improve</span>
                  <span className="font-semibold text-blue-700">
                    {stats.coaching.breakdown.IMPROVE}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fix</span>
                  <span className="font-semibold text-red-700">
                    {stats.coaching.breakdown.FIX}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Suggestion</span>
                  <span className="font-semibold text-amber-700">
                    {stats.coaching.breakdown.SUGGEST}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                Total: {stats.coaching.total} coaching items
              </div>
            </div>

            {/* Trend indicator */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Overall Trend
              </h3>
              <div className="text-center py-3 px-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-2xl mb-2">
                  {stats.trajectory.trend === 'improving' && '📈'}
                  {stats.trajectory.trend === 'declining' && '📉'}
                  {stats.trajectory.trend === 'stable' && '➡️'}
                </div>
                <div className="font-semibold text-gray-900 capitalize">
                  {stats.trajectory.trend}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent PRs */}
      <div className="mb-8">
        <PRHeatMap prs={stats.recent_prs} />
      </div>

      {/* Coaching history */}
      <div className="mb-8">
        <CoachingHistory
          cards={[]} // TODO: Fetch coaching cards from API
          breakdown={stats.coaching.breakdown}
        />
      </div>

      {/* Manager notes (Phase 6.3) */}
      <ManagerNoteEditor
        developerId={developerId}
        workspaceId={workspaceId}
        userRole="manager" // TODO: Get from auth context
      />
    </div>
  );
}
