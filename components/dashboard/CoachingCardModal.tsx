'use client';

/**
 * CoachingCardModal — Phase 5.3
 * Detailed view of a coaching card with feedback items, file:line links, and related PR info
 */

import { useState } from 'react';

interface FeedbackItem {
  id: string;
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
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
  created_at: string;
  feedback_items?: FeedbackItem[];
}

interface CoachingCardModalProps {
  card: CoachingCard;
  isOpen: boolean;
  onClose: () => void;
  feedbackItems?: FeedbackItem[];
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
        textColor: 'text-green-700',
      };
    case 'IMPROVE':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        badge: 'bg-blue-100 text-blue-800',
        icon: '💡',
        label: 'Improve',
        textColor: 'text-blue-700',
      };
    case 'FIX':
      return {
        bg: 'bg-red-50',
        border: 'border-red-500',
        badge: 'bg-red-100 text-red-800',
        icon: '⚠️',
        label: 'Fix',
        textColor: 'text-red-700',
      };
    case 'SUGGEST':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-500',
        badge: 'bg-amber-100 text-amber-800',
        icon: '🎯',
        label: 'Suggestion',
        textColor: 'text-amber-700',
      };
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-500',
        badge: 'bg-gray-100 text-gray-800',
        icon: '📌',
        label: 'Note',
        textColor: 'text-gray-700',
      };
  }
}

export default function CoachingCardModal({
  card,
  isOpen,
  onClose,
  feedbackItems = [],
}: CoachingCardModalProps) {
  const config = getSeverityConfig(card.severity);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyFileLink = (file_path?: string, line_number?: number) => {
    if (!file_path) return;
    const link = line_number ? `${file_path}:${line_number}` : file_path;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFeedback = feedbackItems.filter(
    (item) => item.dimension === card.dimension
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`${config.bg} border-l-4 ${config.border} rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-6 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{config.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {card.title}
                  </h2>
                  <p className="text-sm text-gray-600">PR #{card.pr_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span
                  className={`px-3 py-1 rounded font-semibold text-sm ${config.badge}`}
                >
                  {config.label}
                </span>
                <span className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm font-medium">
                  {card.dimension}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Main Content */}
          <div className="p-6 space-y-6">
            {/* Description */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
              <p className="text-gray-700 leading-relaxed">
                {card.description}
              </p>
            </section>

            {/* File Context */}
            {card.file_path && (
              <section className="bg-white rounded p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">File Location</h3>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm bg-gray-100 px-3 py-2 rounded flex-1">
                    <span className="text-gray-600">{card.file_path}</span>
                    {card.line_number && (
                      <span className="text-blue-600 font-semibold">
                        :{card.line_number}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyFileLink(card.file_path, card.line_number)}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </section>
            )}

            {/* Related Feedback Items */}
            {filteredFeedback.length > 0 && (
              <section>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Related Feedback ({filteredFeedback.length})
                </h3>
                <div className="space-y-3">
                  {filteredFeedback.map((item) => {
                    const itemConfig = getSeverityConfig(item.severity);
                    return (
                      <div
                        key={item.id}
                        className={`${itemConfig.bg} border-l-2 ${itemConfig.border} rounded p-3`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{itemConfig.icon}</span>
                            <h4 className="font-semibold text-gray-900">
                              {item.title}
                            </h4>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${itemConfig.badge}`}
                          >
                            {itemConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          {item.description}
                        </p>
                        {item.file_path && (
                          <button
                            onClick={() =>
                              copyFileLink(item.file_path, item.line_number)
                            }
                            className="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            📄 {item.file_path}
                            {item.line_number && `:${item.line_number}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Action Guidance */}
            <section className="bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-semibold text-blue-900 mb-2">💡 What to do</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                {card.severity === 'GOOD' && (
                  <>
                    <li>This is a strength — keep doing this!</li>
                    <li>Use this pattern in similar areas of your code</li>
                    <li>Help teammates learn this approach</li>
                  </>
                )}
                {card.severity === 'IMPROVE' && (
                  <>
                    <li>Consider these suggestions for next time</li>
                    <li>Small tweaks can make a big difference</li>
                    <li>Review similar code for consistency</li>
                  </>
                )}
                {card.severity === 'FIX' && (
                  <>
                    <li>This needs attention to prevent issues</li>
                    <li>Priority: address in next PR or follow-up</li>
                    <li>Check similar code for the same issue</li>
                  </>
                )}
                {card.severity === 'SUGGEST' && (
                  <>
                    <li>This is optional but worth considering</li>
                    <li>Could simplify or improve your approach</li>
                    <li>Implement when you have time</li>
                  </>
                )}
              </ul>
            </section>

            {/* Metadata */}
            <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
              <p>Feedback from: {new Date(card.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
