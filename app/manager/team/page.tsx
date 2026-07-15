'use client';

/**
 * Manager Team Garden — Phase 6.1
 * Team overview with garden visualization showing team growth stages
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GardenVisualization from '@/components/manager/GardenVisualization';
import { ManualScanButton } from '@/components/manager/ManualScanButton';
import { ScorePRsButton } from '@/components/manager/ScorePRsButton';
import { authedFetch } from '@/lib/authed-fetch';

interface TeamMember {
  id: string;
  display_name: string;
  email: string;
  github_handle?: string;
  role: string;
  stage: 'flourishing' | 'mature' | 'sapling' | 'seedling' | 'no_data';
  pr_count: number;
  score_30d: number | null;
  confidence: string;
  dimensions: {
    quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    tests: number | null;
  };
}

interface Stats {
  total_members: number;
  members_with_data: number;
  members_no_data: number;
  stage_breakdown: Record<string, number>;
  avg_score_30d: number | null;
}

export default function ManagerTeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeZeroPR, setIncludeZeroPR] = useState(false);

  useEffect(() => {
    const fetchTeamStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get workspace from query params or auth
        const workspaceId = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : ''
        ).get('workspace_id');

        if (!workspaceId) {
          setError('No workspace selected');
          return;
        }

        const params = new URLSearchParams();
        params.set('workspace_id', workspaceId);
        params.set('includeZeroPR', includeZeroPR.toString());

        const response = await authedFetch(`/api/manager/team/garden-stats?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch team stats');
        }

        const data = await response.json();
        setMembers(data.members);
        setStats(data.stats);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load team stats'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTeamStats();
  }, [includeZeroPR]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error loading team</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🌱 Team Garden</h1>
        <p className="text-gray-600">
          Watch your team grow. Each member is shown as a plant, representing their growth stage based on 30-day development metrics.
        </p>
      </div>

      {/* Manual GitHub Scan */}
      <div className="mb-8 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">GitHub PR Scanning</h2>
        <ManualScanButton
          workspaceId={new URLSearchParams(
            typeof window !== 'undefined' ? window.location.search : ''
          ).get('workspace_id') || ''}
        />
      </div>

      {/* Manual PR Scoring (test-only) */}
      <div className="mb-8 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">PR Scoring (Manual Test)</h2>
        <ScorePRsButton
          workspaceId={new URLSearchParams(
            typeof window !== 'undefined' ? window.location.search : ''
          ).get('workspace_id') || ''}
        />
      </div>

      {/* Toggle for zero-PR members */}
      <div className="mb-8 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeZeroPR}
            onChange={(e) => setIncludeZeroPR(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">
            Show members with no PRs ({stats?.members_no_data || 0})
          </span>
        </label>
      </div>

      {/* Garden visualization */}
      {members.length > 0 && stats ? (
        <GardenVisualization members={members} stats={stats} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-800">
          <p className="font-semibold">No team data available</p>
          <p className="text-sm mt-1">
            Start inviting team members and they'll appear here once they've submitted code for review.
          </p>
        </div>
      )}
    </div>
  );
}
