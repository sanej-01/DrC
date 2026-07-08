'use client';

/**
 * TrendComparison — Phase 5.2
 * Show each dimension (code_quality, bug_risk, architecture, test_coverage)
 * across 30/60/90 day windows with trend indicators (↑ improving, ↓ declining, → stable)
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

interface TrendComparisonProps {
  data_30d: AggregateWindow;
  data_60d: AggregateWindow;
  data_90d: AggregateWindow;
}

interface DimensionConfig {
  key: keyof Omit<AggregateWindow, 'days' | 'score_count' | 'confidence_badge'>;
  label: string;
  icon: string;
  inverse?: boolean;
}

const DIMENSIONS: DimensionConfig[] = [
  {
    key: 'avg_code_quality',
    label: 'Code Quality',
    icon: '✨',
  },
  {
    key: 'avg_bug_risk',
    label: 'Bug Risk',
    icon: '🐛',
    inverse: true,
  },
  {
    key: 'avg_architecture',
    label: 'Architecture',
    icon: '🏗️',
  },
  {
    key: 'avg_test_coverage',
    label: 'Test Coverage',
    icon: '✅',
  },
];

function getTrend(value90: number | null, value30: number | null, inverse?: boolean): string {
  if (value90 === null || value30 === null) return '—';

  const adj90 = inverse ? 100 - value90 : value90;
  const adj30 = inverse ? 100 - value30 : value30;
  const diff = adj30 - adj90;

  if (diff > 5) return '↑';
  if (diff < -5) return '↓';
  return '→';
}

function getTrendColor(value90: number | null, value30: number | null, inverse?: boolean): string {
  const trend = getTrend(value90, value30, inverse);
  if (trend === '↑') return 'text-green-600';
  if (trend === '↓') return 'text-red-600';
  return 'text-gray-600';
}

function formatScore(score: number | null): string {
  return score !== null ? Math.round(score).toString() : '—';
}

export default function TrendComparison({
  data_30d,
  data_60d,
  data_90d,
}: TrendComparisonProps) {
  return (
    <div className="space-y-4">
      {DIMENSIONS.map((dim) => {
        const value_90d = data_90d[dim.key];
        const value_60d = data_60d[dim.key];
        const value_30d = data_30d[dim.key];

        const display_90d = dim.inverse && value_90d !== null ? 100 - value_90d : value_90d;
        const display_60d = dim.inverse && value_60d !== null ? 100 - value_60d : value_60d;
        const display_30d = dim.inverse && value_30d !== null ? 100 - value_30d : value_30d;

        const trend = getTrend(value_90d, value_30d, dim.inverse);
        const trendColor = getTrendColor(value_90d, value_30d, dim.inverse);

        return (
          <div key={dim.key} className="border border-gray-200 rounded-lg p-4">
            {/* Header with dimension name and trend */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{dim.icon}</span>
                <h3 className="font-semibold text-gray-900">{dim.label}</h3>
              </div>
              <span className={`text-2xl font-bold ${trendColor}`}>{trend}</span>
            </div>

            {/* Scores across windows */}
            <div className="grid grid-cols-3 gap-2">
              {/* 90-day */}
              <div className="bg-gray-50 rounded p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">90-day</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatScore(display_90d)}
                </p>
                {value_90d !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {data_90d.score_count} PRs
                  </p>
                )}
              </div>

              {/* 60-day */}
              <div className="bg-gray-50 rounded p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">60-day</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatScore(display_60d)}
                </p>
                {value_60d !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {data_60d.score_count} PRs
                  </p>
                )}
              </div>

              {/* 30-day */}
              <div className="bg-blue-50 rounded p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">30-day (Now)</p>
                <p className={`text-lg font-semibold ${trendColor}`}>
                  {formatScore(display_30d)}
                </p>
                {value_30d !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {data_30d.score_count} PRs
                  </p>
                )}
              </div>
            </div>

            {/* Trend interpretation */}
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              {trend === '↑' && (
                <span className="text-green-700 font-medium">
                  ✓ Trending up — keep up the good work!
                </span>
              )}
              {trend === '↓' && (
                <span className="text-red-700 font-medium">
                  ⚠ Trending down — focus on this area
                </span>
              )}
              {trend === '→' && (
                <span className="text-gray-700">
                  — Stable performance
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
