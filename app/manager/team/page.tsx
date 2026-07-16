'use client';

/**
 * Manager Team Garden — Phase 6.1
 * Team overview with garden visualization showing team growth stages
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GardenVisualization from '@/components/manager/GardenVisualization';
import { ManualScanButton } from '@/components/manager/ManualScanButton';
import { PRDetailsList } from '@/components/manager/PRDetailsList';
import ScoringChecklistAccordion from '@/components/manager/ScoringChecklistAccordion';
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
  const [prDetailsRefreshKey, setPrDetailsRefreshKey] = useState(0);
  const [hasPrData, setHasPrData] = useState<boolean | null>(null);

  // Initial value + live updates for the "Show members with no PRs"
  // toggle, which now lives in the Topbar account menu instead of on
  // this page - see the matching localStorage/event code in Topbar.tsx.
  useEffect(() => {
    setIncludeZeroPR(localStorage.getItem('drc_include_zero_pr') === 'true');
    const handleToggle = (e: Event) => {
      setIncludeZeroPR((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('drc:includeZeroPRChange', handleToggle);
    return () => window.removeEventListener('drc:includeZeroPRChange', handleToggle);
  }, []);

  useEffect(() => {
    // Guards against toggling the checkbox faster than a request
    // round-trip: without this, an in-flight request for the *previous*
    // includeZeroPR value can resolve after the latest one and overwrite
    // state with stale results (e.g. a late "checked" response landing
    // after the "unchecked" one, showing no-data members despite the
    // checkbox displaying unchecked).
    let cancelled = false;

    const fetchTeamStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get workspace from query params or auth
        const workspaceId = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : ''
        ).get('workspace_id');

        if (!workspaceId) {
          if (!cancelled) setError('No workspace selected');
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
        if (cancelled) return;
        setMembers(data.members);
        setStats(data.stats);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load team stats'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTeamStats();
    return () => {
      cancelled = true;
    };
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

  const workspaceId =
    new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    ).get('workspace_id') || '';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🌱 Team Garden</h1>
        <p className="text-gray-600">
          Watch your team grow. Each member is shown as a plant, representing their growth stage based on 30-day development metrics.
        </p>
      </div>

      {/* Manual GitHub Scan - only shown until there's real scan/PR
          history; once data exists, the same action lives in the
          account menu (top right) instead of taking up page space. */}
      {hasPrData === false && (
        <div className="mb-8 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">GitHub PR Scanning</h2>
          <ManualScanButton
            workspaceId={workspaceId}
            onScanComplete={() => setPrDetailsRefreshKey((k) => k + 1)}
            onScoreComplete={() => setPrDetailsRefreshKey((k) => k + 1)}
          />
        </div>
      )}

      {/* Garden visualization */}
      {members.length > 0 && stats ? (
        <GardenVisualization members={members} stats={stats} workspaceId={workspaceId} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-800">
          <p className="font-semibold">No team data available</p>
          <p className="text-sm mt-1">
            Start inviting team members and they'll appear here once they've submitted code for review.
          </p>
        </div>
      )}

      <div className="mt-8 border-t border-gray-200" />

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">PR Details</h2>
        <PRDetailsList
          workspaceId={workspaceId}
          refreshKey={prDetailsRefreshKey}
          onDataLoaded={(count) => setHasPrData(count > 0)}
        />
      </div>

      <div className="mt-8">
        <ScoringChecklistAccordion />
      </div>
    </div>
  );
}
