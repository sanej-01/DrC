'use client';

/**
 * Manager Individual Developer Detail — Phase 6.2
 * Drill-down view showing the same coaching dashboard layout as /dashboard,
 * wired to the individual developer's data.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DeveloperCoachingDashboard from '@/components/dashboard/DeveloperCoachingDashboard';
import ManagerNoteEditor from '@/components/manager/ManagerNoteEditor';
import { authedFetch } from '@/lib/authed-fetch';

interface IndividualStats {
  developer: {
    id: string;
    display_name: string;
    email: string;
    github_handle?: string;
  };
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

interface DashboardData {
  firstName: string;
  overallScore: number;
  scoreCount30d: number;
  winsLogged: number;
  confident: boolean;
  dimensions: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  momentum: { label: string; arrow: string; color: string };
  streak: boolean[];
  quests: Array<{
    id: string;
    type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
    title: string;
    description: string;
    pr_number: number;
  }>;
  latestCoaching: {
    pr_number: number;
    pr_title: string;
    headline: string;
    tag: string | null;
    body: string;
  } | null;
}

export default function IndividualDeveloperPage() {
  const params = useParams();
  const router = useRouter();
  const developerId = params.developerId as string;

  const [stats, setStats] = useState<IndividualStats | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
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

        const response = await authedFetch(
          `/api/manager/team/${developerId}/individual-stats?workspace_id=${wid}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch developer stats');
        }

        const data = await response.json();
        setStats(data);

        // Transform API response to dashboard data format
        const firstName = (data.developer.display_name || data.developer.email || 'there')
          .split(/[\s@]/)[0];

        const now = Date.now();
        const startOfWeek = new Date();
        const dow = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(startOfWeek.getDate() - dow);

        const streak = [false, false, false, false, false, false, false];
        data.recent_prs.forEach((pr: any) => {
          const d = new Date(pr.merged_at);
          if (d >= startOfWeek) {
            const idx = (d.getDay() + 6) % 7;
            streak[idx] = true;
          }
        });

        let momentum = { label: 'building', arrow: '·', color: 'var(--ink-3)' };
        if (data.trajectory.score_90d !== null && data.trajectory.score_30d !== null) {
          const diff = data.trajectory.score_30d - data.trajectory.score_90d;
          if (diff > 5) momentum = { label: 'improving', arrow: '▲', color: 'var(--good)' };
          else if (diff < -5) momentum = { label: 'watch', arrow: '▼', color: 'var(--bad)' };
          else momentum = { label: 'steady', arrow: '—', color: 'var(--ink-2)' };
        }

        const winsLogged = data.coaching.breakdown.GOOD || 0;
        const confident = data.aggregates?.confidence_30d === 'CONFIDENT';

        const quests = data.recent_prs
          .flatMap((pr: any) => {
            if (!pr.score) return [];
            // In this API, we don't have the full feedback item details,
            // so we construct minimal quest items from the coaching breakdown.
            // Ideally the API would return recent feedback items per PR.
            return [];
          })
          .slice(0, 3);

        let latestCoaching = null;
        const latest = data.recent_prs[0];
        if (latest && latest.score) {
          latestCoaching = {
            pr_number: latest.pr_number,
            pr_title: latest.title,
            headline: 'Reviewed and scored',
            tag: null,
            body: 'This PR received LLM analysis. Detailed feedback is available via the coaching history.',
          };
        }

        setDashboardData({
          firstName,
          overallScore: data.trajectory.score_30d || 0,
          scoreCount30d: data.trajectory.pr_count_30d,
          winsLogged,
          confident,
          dimensions: {
            code_quality: null,
            bug_risk: null,
            architecture: null,
            test_coverage: null,
          },
          momentum,
          streak,
          quests,
          latestCoaching,
        });
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

  if (error || !stats || !dashboardData) {
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

  return (
    <>
      <div className="p-8 pb-4">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to team
        </button>
      </div>
      <DeveloperCoachingDashboard {...dashboardData} />

      {/* Manager notes section */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ManagerNoteEditor
          developerId={stats.developer.id}
          workspaceId={workspaceId}
          userRole="manager"
        />
      </div>
    </>
  );
}
