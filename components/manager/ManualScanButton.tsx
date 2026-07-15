'use client';

import { useState } from 'react';

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

interface ManualScanButtonProps {
  workspaceId: string;
  onScanComplete?: (result: ScanResult) => void;
}

export function ManualScanButton({ workspaceId, onScanComplete }: ManualScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setShowResult(false);

    try {
      const response = await fetch('/api/manager/scan-github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('auth_token') || '' : ''}`,
        },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Scan failed');
      }

      const data: ScanResult = await response.json();
      setResult(data);
      setShowResult(true);
      onScanComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setShowResult(true);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scan Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isScanning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Scanning...
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
          Manually scan for missed PRs (webhooks handle ~99% automatically)
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

      {/* Success State */}
      {result && showResult && !error && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex gap-2 mb-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Scan Completed</p>
              <p className="text-xs text-green-700">{new Date(result.timestamp).toLocaleString()}</p>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="bg-white p-2 rounded border border-green-100">
              <p className="text-xs text-gray-500">Repos Scanned</p>
              <p className="text-lg font-bold text-green-700">{result.repos_scanned}</p>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <p className="text-xs text-gray-500">PRs Checked</p>
              <p className="text-lg font-bold text-blue-700">{result.prs_checked}</p>
            </div>
            <div className="bg-white p-2 rounded border border-purple-100">
              <p className="text-xs text-gray-500">PRs Enqueued</p>
              <p className="text-lg font-bold text-purple-700">{result.prs_enqueued}</p>
            </div>
            <div className="bg-white p-2 rounded border border-gray-100">
              <p className="text-xs text-gray-500">Duplicates Skipped</p>
              <p className="text-lg font-bold text-gray-700">{result.prs_duplicated}</p>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
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

          {/* Repo Details */}
          {result.repos.length > 0 && (
            <details className="mt-3 pt-3 border-t border-green-200">
              <summary className="text-xs font-semibold text-gray-600 cursor-pointer">
                Repository Details ({result.repos.length})
              </summary>
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                {result.repos.map((repo, i) => (
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

          {result.prs_enqueued > 0 && (
            <p className="text-xs text-green-700 mt-3 flex gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zm3 1a1 1 0 100-2 1 1 0 000 2zm3-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
              </svg>
              {result.prs_enqueued} PR{result.prs_enqueued === 1 ? '' : 's'} added to scoring queue
            </p>
          )}
        </div>
      )}
    </div>
  );
}
