'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface ClearScoresButtonProps {
  workspaceId: string;
  onCleared?: () => void;
}

export function ClearScoresButton({ workspaceId, onCleared }: ClearScoresButtonProps) {
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleClear = async () => {
    if (!confirm('Clear all PR scores for this workspace? This lets you re-test scoring from scratch, including the last scanned PR.')) {
      return;
    }

    setIsClearing(true);
    setMessage(null);

    try {
      const response = await authedFetch('/api/manager/clear-pr-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear scores');
      }

      setMessage({
        text: `Cleared ${data.scores_cleared} score${data.scores_cleared === 1 ? '' : 's'}`,
        isError: false,
      });
      onCleared?.();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Unknown error',
        isError: true,
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClear}
        disabled={isClearing}
        className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
      >
        {isClearing ? (
          <>
            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            Clearing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear PR Scores
          </>
        )}
      </button>
      {message && (
        <span className={`text-sm ${message.isError ? 'text-red-600' : 'text-gray-500'}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
