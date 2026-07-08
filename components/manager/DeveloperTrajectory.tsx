'use client';

/**
 * DeveloperTrajectory — Phase 6.2
 * Shows 90-day score trajectory with trend indication
 */

interface TrajectoryData {
  score_90d: number | null;
  score_60d: number | null;
  score_30d: number | null;
  pr_count_90d: number;
  pr_count_60d: number;
  pr_count_30d: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface DeveloperTrajectoryProps {
  trajectory: TrajectoryData;
}

export default function DeveloperTrajectory({
  trajectory,
}: DeveloperTrajectoryProps) {
  const points = [
    {
      label: '90d',
      score: trajectory.score_90d,
      prCount: trajectory.pr_count_90d,
      past: true,
    },
    {
      label: '60d',
      score: trajectory.score_60d,
      prCount: trajectory.pr_count_60d,
      past: true,
    },
    {
      label: '30d',
      score: trajectory.score_30d,
      prCount: trajectory.pr_count_30d,
      current: true,
    },
  ];

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendEmoji = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '❓';
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Declining';
      case 'stable':
        return 'Stable';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          90-Day Trajectory
        </h2>
        <div className={`flex items-center gap-2 font-semibold ${getTrendColor(trajectory.trend)}`}>
          <span className="text-2xl">{getTrendEmoji(trajectory.trend)}</span>
          <span>{getTrendLabel(trajectory.trend)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {points.map((point, idx) => (
          <div key={point.label}>
            <div className="flex items-start gap-4">
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    point.current
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-gray-300 border-gray-400'
                  }`}
                />
                {idx < points.length - 1 && (
                  <div className="w-0.5 h-12 bg-gray-200 mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {point.label === '30d'
                        ? 'Current (Last 30 days)'
                        : `${point.label} ago`}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {point.prCount} PR{point.prCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">
                      {point.score !== null ? point.score : '—'}
                    </div>
                    <div className="text-xs text-gray-600">/100</div>
                  </div>
                </div>

                {/* Score bar */}
                {point.score !== null && (
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        point.score >= 85
                          ? 'bg-green-500'
                          : point.score >= 70
                          ? 'bg-emerald-500'
                          : point.score >= 40
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${point.score}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend analysis */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Analysis</h3>
        <div className="text-sm text-gray-700 space-y-2">
          {trajectory.trend === 'improving' && (
            <>
              <p>✓ Developer is trending upward</p>
              <p>✓ Recent work shows improvement in quality metrics</p>
              <p>✓ Coaching efforts appear effective</p>
            </>
          )}
          {trajectory.trend === 'declining' && (
            <>
              <p>⚠️ Developer is trending downward</p>
              <p>⚠️ Recent work shows decrease in quality metrics</p>
              <p>⚠️ Check for blockers or need for additional support</p>
            </>
          )}
          {trajectory.trend === 'stable' && (
            <>
              <p>→ Developer performance is stable</p>
              <p>→ Consistent quality across recent work</p>
              <p>→ Monitor for any changes in trend</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
