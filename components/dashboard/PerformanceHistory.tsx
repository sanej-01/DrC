'use client';

/**
 * PerformanceHistory — Phase 5.2
 * Summary view of performance across 30/60/90 day windows
 * Reverse-chronological: newest (30-day) at top
 */

interface AggregateWindow {
  days: 30 | 60 | 90;
  avg_code_quality: number | null;
  avg_bug_risk: number | null;
  avg_architecture: number | null;
  avg_test_coverage: number | null;
  score_count: number;
  confidence_badge: 'LOW_CONFIDENCE' | 'CONFIDENT';
}

interface PerformanceHistoryProps {
  data_30d: AggregateWindow;
  data_60d: AggregateWindow;
  data_90d: AggregateWindow;
}

function calculateOverallScore(window: AggregateWindow): number {
  if (
    window.avg_code_quality === null ||
    window.avg_bug_risk === null ||
    window.avg_architecture === null ||
    window.avg_test_coverage === null
  ) {
    return 0;
  }
  return (
    (window.avg_code_quality +
      (100 - window.avg_bug_risk) +
      window.avg_architecture +
      window.avg_test_coverage) /
    4
  );
}

function getScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-green-100';
  if (score >= 70) return 'bg-blue-100';
  if (score >= 55) return 'bg-amber-100';
  return 'bg-red-100';
}

function getScoreTextColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-red-600';
}

export default function PerformanceHistory({
  data_30d,
  data_60d,
  data_90d,
}: PerformanceHistoryProps) {
  const score_30d = calculateOverallScore(data_30d);
  const score_60d = calculateOverallScore(data_60d);
  const score_90d = calculateOverallScore(data_90d);

  // Reverse-chronological: 30-day first (newest), then 60, then 90
  const windows = [
    {
      label: 'Last 30 Days',
      emoji: '📊',
      data: data_30d,
      score: score_30d,
      isLatest: true,
    },
    {
      label: 'Last 60 Days',
      emoji: '📈',
      data: data_60d,
      score: score_60d,
      isLatest: false,
    },
    {
      label: 'Last 90 Days',
      emoji: '📉',
      data: data_90d,
      score: score_90d,
      isLatest: false,
    },
  ];

  return (
    <div className="space-y-4">
      {windows.map((window, idx) => (
        <div
          key={window.label}
          className={`border rounded-lg p-4 transition-all ${
            window.isLatest
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-200 bg-white'
          }`}
        >
          {/* Header with timeline indicator */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{window.emoji}</span>
              <div>
                <h3 className="font-semibold text-gray-900">{window.label}</h3>
                {window.isLatest && (
                  <p className="text-xs text-blue-600 font-medium">Current</p>
                )}
              </div>
            </div>
            <div className={`px-3 py-1 rounded font-semibold ${getScoreBgColor(window.score)}`}>
              <span className={getScoreTextColor(window.score)}>
                {Math.round(window.score)}
              </span>
            </div>
          </div>

          {/* Dimension breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {/* Code Quality */}
            <div className="bg-white rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Quality</p>
              <p className="text-lg font-semibold text-gray-900">
                {window.data.avg_code_quality !== null
                  ? Math.round(window.data.avg_code_quality)
                  : '—'}
              </p>
            </div>

            {/* Bug Risk */}
            <div className="bg-white rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Risk</p>
              <p className="text-lg font-semibold text-gray-900">
                {window.data.avg_bug_risk !== null
                  ? Math.round(100 - window.data.avg_bug_risk)
                  : '—'}
              </p>
            </div>

            {/* Architecture */}
            <div className="bg-white rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Architecture</p>
              <p className="text-lg font-semibold text-gray-900">
                {window.data.avg_architecture !== null
                  ? Math.round(window.data.avg_architecture)
                  : '—'}
              </p>
            </div>

            {/* Test Coverage */}
            <div className="bg-white rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Tests</p>
              <p className="text-lg font-semibold text-gray-900">
                {window.data.avg_test_coverage !== null
                  ? Math.round(window.data.avg_test_coverage)
                  : '—'}
              </p>
            </div>
          </div>

          {/* PR count and confidence */}
          <div className="flex items-center justify-between text-xs text-gray-600 pt-3 border-t border-gray-200">
            <span>
              {window.data.score_count > 0
                ? `${window.data.score_count} PRs scored`
                : 'No data'}
            </span>
            <span
              className={`px-2 py-1 rounded ${
                window.data.confidence_badge === 'CONFIDENT'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {window.data.confidence_badge === 'CONFIDENT' ? '✓ Confident' : '⚠ Low confidence'}
            </span>
          </div>

          {/* Timeline line */}
          {idx < windows.length - 1 && (
            <div className="flex justify-center mt-4">
              <div className="w-0.5 h-8 bg-gray-300" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
