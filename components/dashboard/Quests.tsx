'use client';

/**
 * Quests — Phase 5.1
 * Display coaching cards as actionable quests
 * GOOD (green), IMPROVE (blue), FIX (red), SUGGEST (yellow)
 */

interface CoachingCard {
  id: string;
  dimension: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  file_path?: string;
}

interface QuestsProps {
  coaching_cards: CoachingCard[];
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'GOOD':
      return {
        bg: 'bg-green-50',
        border: 'border-l-4 border-green-500',
        badge: 'bg-green-100 text-green-800',
        icon: '✨',
        label: 'Well Done',
      };
    case 'IMPROVE':
      return {
        bg: 'bg-blue-50',
        border: 'border-l-4 border-blue-500',
        badge: 'bg-blue-100 text-blue-800',
        icon: '💡',
        label: 'Improve',
      };
    case 'FIX':
      return {
        bg: 'bg-red-50',
        border: 'border-l-4 border-red-500',
        badge: 'bg-red-100 text-red-800',
        icon: '⚠️',
        label: 'Fix',
      };
    case 'SUGGEST':
      return {
        bg: 'bg-amber-50',
        border: 'border-l-4 border-amber-500',
        badge: 'bg-amber-100 text-amber-800',
        icon: '🎯',
        label: 'Suggestion',
      };
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-l-4 border-gray-500',
        badge: 'bg-gray-100 text-gray-800',
        icon: '📌',
        label: 'Note',
      };
  }
}

export default function Quests({ coaching_cards }: QuestsProps) {
  if (coaching_cards.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
        <p className="text-green-800">
          🎉 No coaching items right now! Keep up the great work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {coaching_cards.map((card) => {
        const config = getSeverityConfig(card.severity);

        return (
          <div
            key={card.id}
            className={`${config.bg} ${config.border} rounded-lg p-4 transition-all hover:shadow-md`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{config.icon}</span>
                  <h3 className="font-semibold text-gray-900">{card.title}</h3>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${config.badge}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2">{card.description}</p>

                {/* File context */}
                {card.file_path && (
                  <p className="text-xs text-gray-500 mt-2 font-mono">
                    📄 {card.file_path}
                  </p>
                )}
              </div>
            </div>

            {/* Dimension badge */}
            <div className="mt-3 pt-3 border-t border-gray-200/30">
              <span className="inline-block px-2 py-1 bg-white/60 text-xs font-medium text-gray-600 rounded">
                {card.dimension}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
