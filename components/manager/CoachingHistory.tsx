'use client';

/**
 * CoachingHistory — Phase 6.2
 * Developer's coaching feedback with filters by severity and dimension
 */

import { useState } from 'react';

interface CoachingCard {
  id: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension: string;
  created_at: string;
  file_path?: string;
}

interface CoachingHistoryProps {
  cards: CoachingCard[];
  breakdown: {
    GOOD: number;
    IMPROVE: number;
    FIX: number;
    SUGGEST: number;
  };
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'GOOD':
      return {
        badge: 'bg-green-100 text-green-800',
        icon: '✨',
        label: 'Well Done',
      };
    case 'IMPROVE':
      return {
        badge: 'bg-blue-100 text-blue-800',
        icon: '💡',
        label: 'Improve',
      };
    case 'FIX':
      return {
        badge: 'bg-red-100 text-red-800',
        icon: '⚠️',
        label: 'Fix',
      };
    case 'SUGGEST':
      return {
        badge: 'bg-amber-100 text-amber-800',
        icon: '🎯',
        label: 'Suggestion',
      };
    default:
      return {
        badge: 'bg-gray-100 text-gray-800',
        icon: '📌',
        label: 'Note',
      };
  }
}

export default function CoachingHistory({
  cards,
  breakdown,
}: CoachingHistoryProps) {
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterDimension, setFilterDimension] = useState<string | null>(null);

  const dimensions = Array.from(
    new Set(cards.map((c) => c.dimension))
  ).sort();

  const filtered = cards.filter((card) => {
    if (filterSeverity && card.severity !== filterSeverity) return false;
    if (filterDimension && card.dimension !== filterDimension) return false;
    return true;
  });

  const totalCoaching = cards.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Coaching History
      </h2>

      {/* Summary badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="text-xs text-green-600">Well Done</div>
          <div className="text-2xl font-bold text-green-900">
            {breakdown.GOOD}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-600">Improve</div>
          <div className="text-2xl font-bold text-blue-900">
            {breakdown.IMPROVE}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <div className="text-xs text-red-600">Fix</div>
          <div className="text-2xl font-bold text-red-900">{breakdown.FIX}</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <div className="text-xs text-amber-600">Suggestion</div>
          <div className="text-2xl font-bold text-amber-900">
            {breakdown.SUGGEST}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Severity filter */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Filter by Severity
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterSeverity(null)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  filterSeverity === null
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {['GOOD', 'IMPROVE', 'FIX', 'SUGGEST'].map((severity) => {
                const config = getSeverityConfig(severity);
                return (
                  <button
                    key={severity}
                    onClick={() =>
                      setFilterSeverity(
                        filterSeverity === severity ? null : severity
                      )
                    }
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                      filterSeverity === severity
                        ? config.badge
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dimension filter */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Filter by Dimension
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterDimension(null)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  filterDimension === null
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {dimensions.map((dimension) => (
                <button
                  key={dimension}
                  onClick={() =>
                    setFilterDimension(
                      filterDimension === dimension ? null : dimension
                    )
                  }
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    filterDimension === dimension
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {dimension}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Coaching cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Showing {filtered.length} of {totalCoaching} coaching items
          </p>
          {filtered.map((card) => {
            const config = getSeverityConfig(card.severity);
            return (
              <div
                key={card.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl">{config.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {card.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {card.description}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${config.badge}`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {card.dimension}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(card.created_at).toLocaleDateString()}
                  </span>
                  {card.file_path && (
                    <span className="text-xs text-blue-600 font-mono truncate">
                      {card.file_path}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600">
            No coaching items match your filters
          </p>
        </div>
      )}
    </div>
  );
}
