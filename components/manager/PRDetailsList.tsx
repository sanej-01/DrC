'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface FeedbackItem {
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension: string;
  title: string;
  description: string;
  file_path?: string;
  line_number?: number;
}

interface PRScore {
  code_quality: number;
  bug_risk: number;
  architecture: number;
  test_coverage: number;
  overall_score: number;
  overall_assessment: string | null;
  feedback: FeedbackItem[];
  scored_at: string;
}

interface PRDetail {
  id: string;
  number: number;
  title: string;
  url: string;
  author_github_handle: string;
  author_display_name: string | null;
  merged_at: string;
  additions_count: number;
  deletions_count: number;
  files_changed_count: number;
  score: PRScore | null;
}

const FEEDBACK_STYLES: Record<FeedbackItem['type'], { bg: string; text: string; icon: string }> = {
  GOOD: { bg: 'bg-green-50', text: 'text-green-800', icon: '✓' },
  IMPROVE: { bg: 'bg-blue-50', text: 'text-blue-800', icon: '↑' },
  FIX: { bg: 'bg-red-50', text: 'text-red-800', icon: '✕' },
  SUGGEST: { bg: 'bg-amber-50', text: 'text-amber-800', icon: '💡' },
};

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-700 bg-green-100';
  if (score >= 70) return 'text-blue-700 bg-blue-100';
  if (score >= 55) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

interface PRDetailsListProps {
  workspaceId: string;
  refreshKey?: number;
  onDataLoaded?: (count: number) => void;
}

export function PRDetailsList({ workspaceId, refreshKey, onDataLoaded }: PRDetailsListProps) {
  const [prs, setPrs] = useState<PRDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await authedFetch(
          `/api/manager/team/pr-details?workspace_id=${workspaceId}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load PR details');
        }

        const data = await response.json();
        setPrs(data.prs || []);
        onDataLoaded?.((data.prs || []).length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PR details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
    // onDataLoaded intentionally excluded - it's a parent callback, not
    // fetch input; including it would refetch on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, refreshKey]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 bg-gray-100 rounded"></div>
        <div className="h-20 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
        {error}
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
        No PRs yet. Run &quot;Scan GitHub Now&quot; to pull in merged pull requests.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prs.map((pr) => (
        <div
          key={pr.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-semibold text-sm"
              >
                #{pr.number} {pr.title}
              </a>
              <p className="text-xs text-gray-500 mt-1">
                {pr.author_display_name || pr.author_github_handle} · merged{' '}
                {new Date(pr.merged_at).toLocaleDateString()} · {pr.files_changed_count} files
                {' '}(<span className="text-green-600">+{pr.additions_count}</span>{' '}
                <span className="text-red-600">-{pr.deletions_count}</span>)
              </p>
            </div>
            {pr.score && (
              <div
                className={`px-3 py-1 rounded-lg font-bold text-lg flex-shrink-0 ${getScoreColor(
                  pr.score.overall_score
                )}`}
              >
                {pr.score.overall_score}
              </div>
            )}
          </div>

          {!pr.score ? (
            <p className="text-sm text-gray-400 italic mt-2">Not yet scored</p>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Dimension breakdown */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-gray-50 rounded px-2 py-1.5">
                  <p className="text-xs text-gray-500">Quality</p>
                  <p className={`text-sm font-semibold ${getScoreColor(pr.score.code_quality).split(' ')[0]}`}>
                    {pr.score.code_quality}
                  </p>
                </div>
                <div className="bg-gray-50 rounded px-2 py-1.5">
                  <p className="text-xs text-gray-500">Risk</p>
                  <p className={`text-sm font-semibold ${getScoreColor(100 - pr.score.bug_risk).split(' ')[0]}`}>
                    {100 - pr.score.bug_risk}
                  </p>
                </div>
                <div className="bg-gray-50 rounded px-2 py-1.5">
                  <p className="text-xs text-gray-500">Architecture</p>
                  <p className={`text-sm font-semibold ${getScoreColor(pr.score.architecture).split(' ')[0]}`}>
                    {pr.score.architecture}
                  </p>
                </div>
                <div className="bg-gray-50 rounded px-2 py-1.5">
                  <p className="text-xs text-gray-500">Tests</p>
                  <p className={`text-sm font-semibold ${getScoreColor(pr.score.test_coverage).split(' ')[0]}`}>
                    {pr.score.test_coverage}
                  </p>
                </div>
              </div>

              {/* LLM overall assessment */}
              {pr.score.overall_assessment && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-900 mb-1">LLM Analysis</p>
                  <p className="text-sm text-purple-800">{pr.score.overall_assessment}</p>
                </div>
              )}

              {/* Feedback items */}
              {pr.score.feedback && pr.score.feedback.length > 0 && (
                <div className="space-y-1.5">
                  {pr.score.feedback.map((item, i) => {
                    const style = FEEDBACK_STYLES[item.type];
                    return (
                      <div key={i} className={`${style.bg} rounded-lg p-2.5`}>
                        <div className="flex items-start gap-2">
                          <span className={`${style.text} font-bold text-sm`}>{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${style.text}`}>{item.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
                            {item.file_path && (
                              <p className="text-xs text-gray-400 mt-1 font-mono">
                                {item.file_path}
                                {item.line_number ? `:${item.line_number}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
