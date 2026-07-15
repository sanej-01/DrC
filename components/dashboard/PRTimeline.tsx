'use client';

/**
 * PRTimeline — Phase 5.1
 * Reverse-chronological PR list with scores and metadata
 * Newest at top, showing code_quality, bug_risk, architecture, test_coverage
 */

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

interface PRTimelineProps {
  prs: PR[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600 bg-green-50';
  if (score >= 70) return 'text-blue-600 bg-blue-50';
  if (score >= 55) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-green-100';
  if (score >= 70) return 'bg-blue-100';
  if (score >= 55) return 'bg-amber-100';
  return 'bg-red-100';
}

export default function PRTimeline({ prs }: PRTimelineProps) {
  if (prs.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-500">No PRs scored yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prs.map((pr, idx) => {
        const scores = pr.scores;
        const avgScore = scores
          ? Math.round(
              (scores.code_quality +
                (100 - scores.bug_risk) +
                scores.architecture +
                scores.test_coverage) /
                4
            )
          : null;

        return (
          <div
            key={pr.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
          >
            {/* Timeline line and dot */}
            <div className="flex gap-4">
              {/* Left timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    avgScore !== null
                      ? avgScore >= 75
                        ? 'bg-green-500 border-green-300'
                        : 'bg-amber-500 border-amber-300'
                      : 'bg-gray-300 border-gray-200'
                  }`}
                />
                {idx < prs.length - 1 && (
                  <div className="w-0.5 h-12 bg-gray-200 my-2" />
                )}
              </div>

              {/* PR content */}
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <a
                      href={`#pr-${pr.number}`}
                      className="text-blue-600 hover:underline font-semibold text-sm"
                    >
                      #{pr.number}
                    </a>
                    <p className="text-gray-900 font-medium line-clamp-2">{pr.title}</p>
                  </div>
                  {avgScore !== null && (
                    <div className={`px-2 py-1 rounded font-semibold text-sm whitespace-nowrap ${getScoreBgColor(avgScore)}`}>
                      <span className={getScoreColor(avgScore)}>{avgScore}</span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="text-xs text-gray-500 space-y-1 mb-3">
                  <p>📅 Merged {formatDate(pr.merged_at)}</p>
                  <p>
                    📝 {pr.files_changed_count} files •{' '}
                    <span className="text-green-600">+{pr.additions_count}</span>
                    <span className="text-red-600"> -{pr.deletions_count}</span>
                  </p>
                </div>

                {/* Scores */}
                {scores && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <p className="text-xs text-gray-600">Quality</p>
                      <p className={`text-sm font-semibold ${getScoreColor(scores.code_quality)}`}>
                        {scores.code_quality}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <p className="text-xs text-gray-600">Risk</p>
                      <p className={`text-sm font-semibold ${getScoreColor(100 - scores.bug_risk)}`}>
                        {100 - scores.bug_risk}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <p className="text-xs text-gray-600">Architecture</p>
                      <p className={`text-sm font-semibold ${getScoreColor(scores.architecture)}`}>
                        {scores.architecture}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <p className="text-xs text-gray-600">Tests</p>
                      <p className={`text-sm font-semibold ${getScoreColor(scores.test_coverage)}`}>
                        {scores.test_coverage}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
