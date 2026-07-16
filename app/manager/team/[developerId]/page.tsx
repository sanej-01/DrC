'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DeveloperCoachingDashboard from '@/components/dashboard/DeveloperCoachingDashboard';
import ManagerNoteEditor from '@/components/manager/ManagerNoteEditor';
import ReviewDetailsModal from '@/components/manager/ReviewDetailsModal';
import { authedFetch } from '@/lib/authed-fetch';

interface ReviewDetail {
  pr_number: number;
  pr_title: string;
  merged_at: string;
  overall_score: number;
  dimensions: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  overall_assessment: string | null;
  feedback: Array<{
    type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
    dimension: string | null;
    title: string | null;
    description: string | null;
    file_path: string | null;
    line_number: number | null;
  }>;
}

interface ApiResponse {
  developer: {
    id: string;
    display_name: string;
    email: string;
    github_handle?: string;
  };
  trajectory: {
    score_30d: number | null;
    score_60d: number | null;
    score_90d: number | null;
    pr_count_30d: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  aggregates: { confidence_30d: string } | null;
  coaching: { breakdown: { GOOD: number } };
  dimensions_30d: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  quest_items: Array<{
    id: string;
    type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
    title: string;
    description: string;
    dimension: string | null;
    pr_number: number;
  }>;
  latest_coaching: {
    pr_number: number;
    pr_title: string;
    headline: string;
    tag: string | null;
    body: string;
  } | null;
  recent_prs: Array<{ merged_at: string }>;
  review_details: ReviewDetail[];
}

export default function IndividualDeveloperPage() {
  const params = useParams();
  const router = useRouter();
  const developerId = params.developerId as string;

  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const wid = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : ''
        ).get('workspace_id');

        if (!wid) { setError('No workspace selected'); return; }
        setWorkspaceId(wid);

        const response = await authedFetch(
          `/api/manager/team/${developerId}/individual-stats?workspace_id=${wid}`
        );

        if (!response.ok) {
          const d = await response.json();
          throw new Error(d.error || 'Failed to fetch developer stats');
        }

        setApiData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load developer stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [developerId]);

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    </div>
  );

  if (error || !apiData) return (
    <div className="p-8">
      <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 font-medium mb-4">
        ← Back to team
      </button>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">Error loading developer</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  const streak = [false, false, false, false, false, false, false];
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  apiData.recent_prs.forEach((pr) => {
    const d = new Date(pr.merged_at);
    if (d >= startOfWeek) streak[(d.getDay() + 6) % 7] = true;
  });

  const trend = apiData.trajectory.trend;
  const momentum =
    trend === 'improving' ? { label: 'improving', arrow: '▲', color: 'var(--good)' } :
    trend === 'declining' ? { label: 'watch',      arrow: '▼', color: 'var(--bad)'  } :
                            { label: 'steady',     arrow: '—', color: 'var(--ink-2)' };

  const firstName = (apiData.developer.display_name || apiData.developer.email || 'there')
    .split(/[\s@]/)[0];

  const dashboardProps = {
    firstName,
    overallScore: apiData.trajectory.score_30d || 0,
    scoreCount30d: apiData.trajectory.pr_count_30d,
    winsLogged: apiData.coaching.breakdown.GOOD || 0,
    confident: apiData.aggregates?.confidence_30d === 'CONFIDENT',
    dimensions: apiData.dimensions_30d,
    momentum,
    streak,
    quests: apiData.quest_items,
    latestCoaching: apiData.latest_coaching,
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <button
          onClick={() => router.back()}
          className="font-medium"
          style={{ color: 'var(--sage-ink)' }}
        >
          ← Back to team
        </button>
      </div>

      <DeveloperCoachingDashboard {...dashboardProps} />

      <div className="mx-auto max-w-2xl px-6 pb-8 space-y-6">
        <ManagerNoteEditor
          developerId={apiData.developer.id}
          workspaceId={workspaceId}
          userRole="manager"
        />

        {/* LLM analysis link */}
        <div className="text-center">
          <button
            onClick={() => setShowReviews(true)}
            className="inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-[10px] transition-colors"
            style={{
              color: 'var(--sage-ink)',
              background: 'var(--sage-soft)',
              border: '1px solid var(--line)',
            }}
          >
            🔍 View full LLM analysis · {apiData.review_details.length} PR{apiData.review_details.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {showReviews && (
        <ReviewDetailsModal
          reviews={apiData.review_details}
          onClose={() => setShowReviews(false)}
        />
      )}
    </>
  );
}
