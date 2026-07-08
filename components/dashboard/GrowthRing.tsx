'use client';

/**
 * GrowthRing — Phase 5.1
 * Animated circular progress ring showing overall score (0-100)
 * Center shows score percentage, ring color indicates performance
 */

interface GrowthRingProps {
  score: number; // 0-100
}

export default function GrowthRing({ score }: GrowthRingProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Color based on score
  const getColor = (s: number) => {
    if (s >= 85) return '#10b981'; // Green
    if (s >= 70) return '#3b82f6'; // Blue
    if (s >= 55) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-lg">
        {/* Background ring */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />

        {/* Progress ring */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease-out',
            transform: 'rotate(-90deg)',
            transformOrigin: '100px 100px',
          }}
        />

        {/* Center text */}
        <text
          x="100"
          y="105"
          textAnchor="middle"
          fontSize="32"
          fontWeight="bold"
          fill={color}
          className="drop-shadow-sm"
        >
          {Math.round(score)}
        </text>
        <text
          x="100"
          y="125"
          textAnchor="middle"
          fontSize="12"
          fill="#6b7280"
        >
          /100
        </text>
      </svg>

      {/* Label */}
      <div className="mt-4 text-center">
        <p className="text-sm font-semibold text-gray-700">Overall Growth Score</p>
        <p className="text-xs text-gray-500 mt-1">
          {score >= 85 && '🌟 Excellent'}
          {score >= 70 && score < 85 && '✨ Great'}
          {score >= 55 && score < 70 && '💪 Developing'}
          {score < 55 && '🎯 Building'}
        </p>
      </div>
    </div>
  );
}
