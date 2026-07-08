'use client';

/**
 * CoachingCardDetailView — Phase 5.3
 * Full-page detailed view of a coaching card with all related feedback
 * Phase 5.4: Integrated feedback thumbs voting
 */

import { useState } from 'react';
import FeedbackThumbs from './FeedbackThumbs';

interface FeedbackItem {
  id: string;
  dimension: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  file_path?: string;
  line_number?: number;
}

interface CoachingCard {
  id: string;
  pr_id: string;
  pr_number: number;
  dimension: string;
  title: string;
  description: string;
  severity: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  file_path?: string;
  line_number?: number;
  created_at: string;
}

interface CoachingCardDetailViewProps {
  card: CoachingCard;
  feedbackItems: FeedbackItem[];
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'GOOD':
      return {
        bg: 'bg-green-50',
        border: 'border-green-500',
        badge: 'bg-green-100 text-green-800',
        icon: '✨',
        label: 'Well Done',
        headerBg: 'bg-green-100',
      };
    case 'IMPROVE':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        badge: 'bg-blue-100 text-blue-800',
        icon: '💡',
        label: 'Improve',
        headerBg: 'bg-blue-100',
      };
    case 'FIX':
      return {
        bg: 'bg-red-50',
        border: 'border-red-500',
        badge: 'bg-red-100 text-red-800',
        icon: '⚠️',
        label: 'Fix',
        headerBg: 'bg-red-100',
      };
    case 'SUGGEST':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-500',
        badge: 'bg-amber-100 text-amber-800',
        icon: '🎯',
        label: 'Suggestion',
        headerBg: 'bg-amber-100',
      };
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-500',
        badge: 'bg-gray-100 text-gray-800',
        icon: '📌',
        label: 'Note',
        headerBg: 'bg-gray-100',
      };
  }
}

export default function CoachingCardDetailView({
  card,
  feedbackItems,
}: CoachingCardDetailViewProps) {
  const config = getSeverityConfig(card.severity);
  const [copied, setCopied] = useState(false);

  const copyFileLink = (file_path?: string, line_number?: number) => {
    if (!file_path) return;
    const link = line_number ? `${file_path}:${line_number}` : file_path;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <div className={`${config.bg} border-l-4 ${config.border} rounded-lg p-8`}>
        <div className="flex items-start gap-4 mb-6">
          <span className="text-5xl">{config.icon}</span>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {card.title}
            </h1>
            <p className="text-gray-600 mb-4">PR #{card.pr_number}</p>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded font-semibold ${config.badge}`}>
                {config.label}
              </span>
              <span className="px-4 py-2 rounded bg-white text-gray-700 font-medium">
                {card.dimension}
              </span>
            </div>
          </div>
        </div>

        {/* Main description */}
        <div className="mt-6 pt-6 border-t border-gray-200/50">
          <h2 className="font-semibold text-gray-900 mb-3">Overview</h2>
          <p className="text-gray-700 leading-relaxed text-lg">
            {card.description}
          </p>
        </div>
      </div>

      {/* File Context */}
      {card.file_path && (
        <section className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📍 File Location
          </h2>
          <div className="flex items-center justify-between gap-4 bg-gray-50 p-4 rounded border border-gray-200">
            <div className="font-mono text-sm break-all">
              <span className="text-gray-600">{card.file_path}</span>
              {card.line_number && (
                <span className="text-blue-600 font-semibold">
                  :{card.line_number}
                </span>
              )}
            </div>
            <button
              onClick={() => copyFileLink(card.file_path, card.line_number)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded whitespace-nowrap"
            >
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
        </section>
      )}

      {/* Related Feedback */}
      {feedbackItems.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🔍 All Feedback from This PR ({feedbackItems.length})
          </h2>

          <div className="space-y-4">
            {feedbackItems.map((item) => {
              const itemConfig = getSeverityConfig(item.severity);
              const isHighlight = item.dimension === card.dimension;

              return (
                <div
                  key={item.id}
                  className={`${isHighlight ? itemConfig.headerBg + ' border-2' : 'border'} ${itemConfig.border} rounded-lg p-4 transition-all ${
                    isHighlight ? 'ring-2 ring-offset-2 ' + itemConfig.border : ''
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{itemConfig.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          Dimension: <span className="font-medium">{item.dimension}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded whitespace-nowrap ${itemConfig.badge}`}
                    >
                      {itemConfig.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-700 mb-3 ml-10">
                    {item.description}
                  </p>

                  {/* File link */}
                  {item.file_path && (
                    <button
                      onClick={() => copyFileLink(item.file_path, item.line_number)}
                      className="ml-10 text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      📄 {item.file_path}
                      {item.line_number && `:${item.line_number}`}
                    </button>
                  )}

                  {isHighlight && (
                    <div className="mt-2 ml-10 pt-2 border-t border-gray-300/50">
                      <span className="text-xs font-medium text-gray-600">
                        ⭐ This is the coaching item you selected
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Action Guidance */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h2 className="font-semibold text-blue-900 mb-4">
          💡 Recommended Actions
        </h2>

        <div className="space-y-3 text-blue-800">
          {card.severity === 'GOOD' && (
            <>
              <p>✓ <span className="font-medium">This is a strength!</span> Keep applying this pattern.</p>
              <p>✓ <span className="font-medium">Share knowledge:</span> Help teammates learn this approach.</p>
              <p>✓ <span className="font-medium">Be consistent:</span> Apply in similar code areas.</p>
            </>
          )}
          {card.severity === 'IMPROVE' && (
            <>
              <p>💭 <span className="font-medium">Consider these suggestions</span> for your next PR.</p>
              <p>💭 <span className="font-medium">Small tweaks</span> can significantly improve quality.</p>
              <p>💭 <span className="font-medium">Review similar code</span> for consistency.</p>
            </>
          )}
          {card.severity === 'FIX' && (
            <>
              <p>🔧 <span className="font-medium">Priority:</span> Address this to prevent issues.</p>
              <p>🔧 <span className="font-medium">Check related code</span> for the same issue.</p>
              <p>🔧 <span className="font-medium">Plan a follow-up PR</span> if not critical.</p>
            </>
          )}
          {card.severity === 'SUGGEST' && (
            <>
              <p>🎯 <span className="font-medium">This is optional</span> but worth considering.</p>
              <p>🎯 <span className="font-medium">Could simplify</span> or improve your approach.</p>
              <p>🎯 <span className="font-medium">Implement when ready</span> — no urgency required.</p>
            </>
          )}
        </div>
      </section>

      {/* Feedback Thumbs (Phase 5.4) */}
      <section>
        <FeedbackThumbs coaching_card_id={card.id} compact={false} />
      </section>

      {/* Metadata */}
      <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded border border-gray-200">
        <p>📅 Coaching provided: {new Date(card.created_at).toLocaleString()}</p>
        <p>📋 Card ID: <span className="font-mono text-xs">{card.id}</span></p>
      </div>
    </div>
  );
}
