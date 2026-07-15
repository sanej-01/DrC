'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

export interface ScanResult {
  workspace_id: string;
  timestamp: string;
  repos_scanned: number;
  prs_checked: number;
  prs_enqueued: number;
  prs_duplicated: number;
  repos: Array<{
    repo_id: string;
    prs_checked: number;
    prs_enqueued: number;
    prs_duplicated: number;
  }>;
  errors: string[];
}

export interface ScoringResult {
  workspace_id: string;
  timestamp: string;
  prs_checked: number;
  prs_already_scored: number;
  prs_scored: number;
  errors: string[];
}

interface ManualScanButtonProps {
  workspaceId: string;
  onScanComplete?: (result: ScanResult) => void;
  onScoreComplete?: (result: ScoringResult) => void;
}

export function ManualScanButton({
  workspaceId,
  onScanComplete,
  onScoreComplete,
}: ManualScanButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleScanAndScore = async () => {
    setIsRunning(true);
    setError(null);
    setShowResult(false);
    setScanResult(null);
    setScoreResult(null);

    try {
      const scanResponse = await authedFetch('/api/manager/scan-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!scanResponse.ok) {
        const errorData = await scanResponse.json();
        throw new Error(errorData.error || 'Scan failed');
      }

      const scanData: ScanResult = await scanResponse.json();
      setScanResult(scanData);
      setShowResult(true);
      onScanComplete?.(scanData);

      // Score right after scanning so a single action takes you from
      // "found a PR" to "have an analysis" without a second click.
      const scoreResponse = await authedFetch('/api/manager/score-prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (scoreResponse.ok) {
        const scoreData: ScoringResult = await scoreResponse.json();
        setScoreResult(scoreData);
        onScoreComplete?.(scoreData);
      } else {
        const errorData = await scoreResponse.json();
        console.warn('Scoring after scan failed:', errorData.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setShowResult(true);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scan Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleScanAndScore}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Scanning &amp; Scoring...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan GitHub Now
            </>
          )}
        </button>
        <p className="text-sm text-gray-500">
          Manually scan for missed PRs and score them (webhooks handle ~99% automatically)
        </p>
      </div>

      {/* Error State */}
      {error && showResult && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-red-900">Scan Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scan Result */}
      {scanResult && showResult && !error && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex gap-2 mb-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Scan Completed</p>
              <p className="text-xs text-green-700">{new Date(scanResult.timestamp).toLocaleString()}</p>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="bg-white p-2 rounded border border-green-100">
              <p className="text-xs text-gray-500">Repos Scanned</p>
              <p className="text-lg font-bold text-green-700">{scanResult.repos_scanned}</p>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <p className="text-xs text-gray-500">PRs Checked</p>
              <p className="text-lg font-bold text-blue-700">{scanResult.prs_checked}</p>
            </div>
            <div className="bg-white p-2 rounded border border-purple-100">
              <p className="text-xs text-gray-500">PRs Enqueued</p>
              <p className="text-lg font-bold text-purple-700">{scanResult.prs_enqueued}</p>
            </div>
            <div className="bg-white p-2 rounded border border-gray-100">
              <p className="text-xs text-gray-500">Duplicates Skipped</p>
              <p className="text-lg font-bold text-gray-700">{scanResult.prs_duplicated}</p>
            </div>
          </div>

          {/* Errors */}
          {scanResult.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs font-semibold text-gray-600">Issues:</p>
              <ul className="text-xs text-gray-600 space-y-1 mt-1">
                {scanResult.errors.map((err, i) => (
                  <li key={i} className="flex gap-2">
                    <span>•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Repo Details */}
          {scanResult.repos.length > 0 && (
            <details className="mt-3 pt-3 border-t border-green-200">
              <summary className="text-xs font-semibold text-gray-600 cursor-pointer">
                Repository Details ({scanResult.repos.length})
              </summary>
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                {scanResult.repos.map((repo, i) => (
                  <div key={i} className="flex justify-between p-1 bg-white rounded">
                    <span>{repo.repo_id}</span>
                    <span className="text-gray-400">
                      {repo.prs_checked} checked, {repo.prs_enqueued} enqueued
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Score Result */}
      {scoreResult && showResult && !error && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-purple-900">Scoring Completed</p>
              <p className="text-xs text-purple-700">{new Date(scoreResult.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white p-2 rounded border border-purple-100">
              <p className="text-xs text-gray-500">PRs Checked</p>
              <p className="text-lg font-bold text-purple-700">{scoreResult.prs_checked}</p>
            </div>
            <div className="bg-white p-2 rounded border border-green-100">
              <p className="text-xs text-gray-500">Newly Scored</p>
              <p className="text-lg font-bold text-green-700">{scoreResult.prs_scored}</p>
            </div>
            <div className="bg-white p-2 rounded border border-gray-100">
              <p className="text-xs text-gray-500">Already Scored</p>
              <p className="text-lg font-bold text-gray-700">{scoreResult.prs_already_scored}</p>
            </div>
          </div>

          {scoreResult.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-purple-200">
              <p className="text-xs font-semibold text-gray-600">Issues:</p>
              <ul className="text-xs text-gray-600 space-y-1 mt-1">
                {scoreResult.errors.map((err, i) => (
                  <li key={i} className="flex gap-2">
                    <span>•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scoreResult.prs_scored > 0 && (
            <p className="text-xs text-purple-700 mt-3 flex gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zm3 1a1 1 0 100-2 1 1 0 000 2zm3-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
              </svg>
              {scoreResult.prs_scored} PR{scoreResult.prs_scored === 1 ? '' : 's'} analyzed — see PR Details below
            </p>
          )}
        </div>
      )}
    </div>
  );
}
