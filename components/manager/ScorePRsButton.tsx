'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

export interface ScoringResult {
  workspace_id: string;
  timestamp: string;
  prs_checked: number;
  prs_already_scored: number;
  prs_scored: number;
  errors: string[];
}

interface ScorePRsButtonProps {
  workspaceId: string;
  onScoreComplete?: (result: ScoringResult) => void;
}

export function ScorePRsButton({ workspaceId, onScoreComplete }: ScorePRsButtonProps) {
  const [isScoring, setIsScoring] = useState(false);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleScore = async () => {
    setIsScoring(true);
    setError(null);
    setShowResult(false);

    try {
      const response = await authedFetch('/api/manager/score-prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Scoring failed');
      }

      const data: ScoringResult = await response.json();
      setResult(data);
      setShowResult(true);
      onScoreComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setShowResult(true);
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handleScore}
          disabled={isScoring}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isScoring ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Scoring...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Score PRs Now
            </>
          )}
        </button>
        <p className="text-sm text-gray-500">
          Manual testing only — scores any unscored PRs in this workspace
        </p>
      </div>

      {error && showResult && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-red-900">Scoring Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && showResult && !error && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-purple-900">Scoring Completed</p>
              <p className="text-xs text-purple-700">{new Date(result.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white p-2 rounded border border-purple-100">
              <p className="text-xs text-gray-500">PRs Checked</p>
              <p className="text-lg font-bold text-purple-700">{result.prs_checked}</p>
            </div>
            <div className="bg-white p-2 rounded border border-green-100">
              <p className="text-xs text-gray-500">Newly Scored</p>
              <p className="text-lg font-bold text-green-700">{result.prs_scored}</p>
            </div>
            <div className="bg-white p-2 rounded border border-gray-100">
              <p className="text-xs text-gray-500">Already Scored</p>
              <p className="text-lg font-bold text-gray-700">{result.prs_already_scored}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-purple-200">
              <p className="text-xs font-semibold text-gray-600">Issues:</p>
              <ul className="text-xs text-gray-600 space-y-1 mt-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="flex gap-2">
                    <span>•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
