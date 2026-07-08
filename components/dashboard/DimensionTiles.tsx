'use client';

/**
 * DimensionTiles — Phase 5.1
 * Four tiles showing code_quality, bug_risk, architecture, test_coverage
 * Each with score, trend arrow, and tooltip
 */

interface DimensionTilesProps {
  stats: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  confidence?: 'LOW_CONFIDENCE' | 'CONFIDENT';
}

interface TileConfig {
  key: keyof DimensionTilesProps['stats'];
  label: string;
  icon: string;
  description: string;
  unit: string;
  inverse?: boolean; // bug_risk is inverse (lower is better)
}

const TILES: TileConfig[] = [
  {
    key: 'code_quality',
    label: 'Code Quality',
    icon: '✨',
    description: 'Style, readability, maintainability',
    unit: '%',
  },
  {
    key: 'bug_risk',
    label: 'Bug Risk',
    icon: '🐛',
    description: 'Likelihood of bugs or crashes',
    unit: '%',
    inverse: true,
  },
  {
    key: 'architecture',
    label: 'Architecture',
    icon: '🏗️',
    description: 'Design, extensibility, patterns',
    unit: '%',
  },
  {
    key: 'test_coverage',
    label: 'Test Coverage',
    icon: '✅',
    description: 'Tests written, coverage quality',
    unit: '%',
  },
];

function getTileColor(score: number | null, inverse?: boolean): string {
  if (score === null) return 'bg-gray-100';
  const adjustedScore = inverse ? 100 - score : score;
  if (adjustedScore >= 85) return 'bg-green-100';
  if (adjustedScore >= 70) return 'bg-blue-100';
  if (adjustedScore >= 55) return 'bg-amber-100';
  return 'bg-red-100';
}

function getScoreColor(score: number | null, inverse?: boolean): string {
  if (score === null) return 'text-gray-500';
  const adjustedScore = inverse ? 100 - score : score;
  if (adjustedScore >= 85) return 'text-green-600';
  if (adjustedScore >= 70) return 'text-blue-600';
  if (adjustedScore >= 55) return 'text-amber-600';
  return 'text-red-600';
}

export default function DimensionTiles({ stats, confidence }: DimensionTilesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {TILES.map((tile) => {
        const score = stats[tile.key];
        const displayScore = tile.inverse && score !== null ? 100 - score : score;

        return (
          <div
            key={tile.key}
            className={`${getTileColor(score, tile.inverse)} rounded-lg p-4 transition-all hover:shadow-md`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-700">{tile.label}</p>
                <p className="text-xs text-gray-500 mt-1">{tile.description}</p>
              </div>
              <span className="text-2xl">{tile.icon}</span>
            </div>

            {/* Score */}
            {score !== null ? (
              <div className="flex items-baseline gap-1">
                <p className={`text-3xl font-bold ${getScoreColor(score, tile.inverse)}`}>
                  {Math.round(displayScore || 0)}
                </p>
                <span className="text-gray-600 text-sm">{tile.unit}</span>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No data yet</p>
            )}

            {/* Confidence indicator */}
            {confidence === 'LOW_CONFIDENCE' && (
              <p className="text-xs text-gray-500 mt-2">
                Low confidence — score more PRs
              </p>
            )}

            {/* Trend (placeholder for future expansion) */}
            <div className="mt-3 pt-3 border-t border-gray-200/50">
              <p className="text-xs text-gray-500">30-day trend →</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
