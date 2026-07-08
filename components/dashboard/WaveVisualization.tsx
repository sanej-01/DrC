'use client';

/**
 * WaveVisualization — Phase 5.2
 * SVG wave chart showing overall performance trend across 30/60/90 days
 * Smooth bezier curve showing performance trajectory
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

interface WaveVisualizationProps {
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

export default function WaveVisualization({
  data_30d,
  data_60d,
  data_90d,
}: WaveVisualizationProps) {
  const score_90d = calculateOverallScore(data_90d);
  const score_60d = calculateOverallScore(data_60d);
  const score_30d = calculateOverallScore(data_30d);

  // Map scores to Y coordinates (0-100 → 150-50, leaving margins)
  const getY = (score: number): number => 150 - (score * 100) / 100;

  const y90 = getY(score_90d);
  const y60 = getY(score_60d);
  const y30 = getY(score_30d);

  // X coordinates for the 3 points
  const x90 = 50;
  const x60 = 200;
  const x30 = 350;

  // Create smooth bezier curve
  const controlX1 = (x90 + x60) / 2;
  const controlY1 = (y90 + y60) / 2 - 20; // Pull up slightly for smoother wave
  const controlX2 = (x60 + x30) / 2;
  const controlY2 = (y60 + y30) / 2 - 20;

  const pathD = `M ${x90} ${y90} Q ${controlX1} ${controlY1}, ${x60} ${y60} T ${x30} ${y30}`;

  // Determine trend (comparing 30d to 90d)
  const trend30to90 = score_30d - score_90d;
  const trendColor =
    trend30to90 > 5 ? '#10b981' : trend30to90 < -5 ? '#ef4444' : '#6b7280';
  const trendLabel = trend30to90 > 5 ? '↑ Improving' : trend30to90 < -5 ? '↓ Declining' : '→ Stable';

  return (
    <div className="space-y-4">
      {/* Wave chart */}
      <svg width="100%" height="200" viewBox="0 0 400 200" className="drop-shadow-sm">
        {/* Grid lines */}
        <line
          x1="0"
          y1="50"
          x2="400"
          y2="50"
          stroke="#f3f4f6"
          strokeWidth="1"
          strokeDasharray="4"
        />
        <line
          x1="0"
          y1="100"
          x2="400"
          y2="100"
          stroke="#f3f4f6"
          strokeWidth="1"
          strokeDasharray="4"
        />
        <line
          x1="0"
          y1="150"
          x2="400"
          y2="150"
          stroke="#f3f4f6"
          strokeWidth="1"
          strokeDasharray="4"
        />

        {/* Y-axis labels */}
        <text x="10" y="55" fontSize="10" fill="#9ca3af" textAnchor="end">
          100
        </text>
        <text x="10" y="105" fontSize="10" fill="#9ca3af" textAnchor="end">
          50
        </text>
        <text x="10" y="155" fontSize="10" fill="#9ca3af" textAnchor="end">
          0
        </text>

        {/* Wave path */}
        <path d={pathD} stroke={trendColor} strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Data points */}
        <circle cx={x90} cy={y90} r="5" fill="#9ca3af" stroke="#fff" strokeWidth="2" />
        <circle cx={x60} cy={y60} r="5" fill="#9ca3af" stroke="#fff" strokeWidth="2" />
        <circle cx={x30} cy={y30} r="5" fill={trendColor} stroke="#fff" strokeWidth="2" />

        {/* X-axis labels */}
        <text x={x90} y="185" fontSize="11" fill="#6b7280" textAnchor="middle" fontWeight="500">
          90d
        </text>
        <text x={x60} y="185" fontSize="11" fill="#6b7280" textAnchor="middle" fontWeight="500">
          60d
        </text>
        <text x={x30} y="185" fontSize="11" fill="#6b7280" textAnchor="middle" fontWeight="500">
          30d
        </text>

        {/* Score labels on points */}
        <text
          x={x90}
          y={y90 - 15}
          fontSize="12"
          fill="#6b7280"
          textAnchor="middle"
          fontWeight="600"
        >
          {Math.round(score_90d)}
        </text>
        <text
          x={x60}
          y={y60 - 15}
          fontSize="12"
          fill="#6b7280"
          textAnchor="middle"
          fontWeight="600"
        >
          {Math.round(score_60d)}
        </text>
        <text
          x={x30}
          y={y30 - 15}
          fontSize="12"
          fill={trendColor}
          textAnchor="middle"
          fontWeight="600"
        >
          {Math.round(score_30d)}
        </text>
      </svg>

      {/* Trend summary */}
      <div className="flex items-center justify-center gap-2">
        <span style={{ color: trendColor }} className="text-lg font-semibold">
          {trendLabel}
        </span>
        <span className="text-gray-600 text-sm">
          ({trend30to90 > 0 ? '+' : ''}{Math.round(trend30to90 * 10) / 10} points)
        </span>
      </div>
    </div>
  );
}
