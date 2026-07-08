'use client';

/**
 * PRHeatMap — Phase 6.2
 * Recent PRs with scores and visual heat indicating performance
 */

interface PRData {
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
}

interface PRHeatMapProps {
  prs: PRData[];
  limit?: number;
}

function getScoreColor(score: number | null) {
  if (score === null) return 'bg-gray-50 border-gray-200';
  if (score >= 85) return 'bg-green-50 border-green-200';
  if (score >= 70) return 'bg-emerald-50 border-emerald-200';
  if (score >= 40) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function getScoreTextColor(score: number | null) {
  if (score === null) return 'text-gray-700';
  if (score >= 85) return 'text-green-700';
  if (score >= 70) return 'text-emerald-700';
  if (score >= 40) return 'text-yellow-700';
  return 'text-red-700';
}

export default function PRHeatMap({ prs, limit = 15 }: PRHeatMapProps) {
  const displayPRs = prs.slice(0, limit);

  if (displayPRs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent PRs
        </h2>
        <p className="text-gray-600">No PRs found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Recent PRs ({displayPRs.length})
      </h2>

      <div className="space-y-3">
        {displayPRs.map((pr) => (
          <div
            key={pr.id}
            className={`border rounded-lg p-4 transition-all hover:shadow-md ${getScoreColor(pr.score)}`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-600">
                    #{pr.pr_number}
                  </span>
                  <h3 className="font-semibold text-gray-900 truncate">
                    {pr.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(pr.merged_at).toLocaleDateString()}
                </p>
              </div>
              {pr.score !== null && (
                <div className={`text-right font-semibold ${getScoreTextColor(pr.score)}`}>
                  <div className="text-2xl">{pr.score}</div>
                  <div className="text-xs">/100</div>
                </div>
              )}
            </div>

            {/* Dimension breakdown */}
            {pr.dimensions && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-gray-200">
                <div className="text-xs">
                  <div className="text-gray-600">Quality</div>
                  <div className="font-semibold text-gray-900">
                    {pr.dimensions.quality !== null ? pr.dimensions.quality : '—'}
                  </div>
                </div>
                <div className="text-xs">
                  <div className="text-gray-600">Risk</div>
                  <div className="font-semibold text-gray-900">
                    {pr.dimensions.bug_risk !== null
                      ? 100 - pr.dimensions.bug_risk
                      : '—'}
                  </div>
                </div>
                <div className="text-xs">
                  <div className="text-gray-600">Architecture</div>
                  <div className="font-semibold text-gray-900">
                    {pr.dimensions.architecture !== null
                      ? pr.dimensions.architecture
                      : '—'}
                  </div>
                </div>
                <div className="text-xs">
                  <div className="text-gray-600">Tests</div>
                  <div className="font-semibold text-gray-900">
                    {pr.dimensions.tests !== null ? pr.dimensions.tests : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
