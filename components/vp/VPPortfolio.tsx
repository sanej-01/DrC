'use client';

/**
 * VP Portfolio — Phase 8.2
 * Read-only organization and team composite dashboard
 */

import { useEffect, useState } from 'react';

interface TeamAggregate {
  id: string;
  team_name: string;
  overall_score_30d?: number;
  developer_count: number;
  total_prs_30d: number;
  trend: 'improving' | 'stable' | 'declining';
  avg_code_quality_30d?: number;
  avg_bug_risk_30d?: number;
  avg_architecture_30d?: number;
  avg_test_coverage_30d?: number;
}

interface EarlyWarning {
  id: string;
  team_name: string;
  warning_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
}

interface WorkspaceSnapshot {
  total_developers: number;
  total_teams: number;
  total_prs_30d: number;
  avg_score_30d?: number;
  teams_improving: number;
  teams_stable: number;
  teams_declining: number;
  critical_warnings: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface VPPortfolioProps {
  workspaceId: string;
}

function getTrendConfig(trend: string) {
  switch (trend) {
    case 'improving':
      return { emoji: '📈', label: 'Improving', color: 'text-green-600' };
    case 'declining':
      return { emoji: '📉', label: 'Declining', color: 'text-red-600' };
    case 'stable':
      return { emoji: '➡️', label: 'Stable', color: 'text-gray-600' };
    default:
      return { emoji: '❓', label: 'Unknown', color: 'text-gray-600' };
  }
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'critical':
      return { emoji: '🔴', label: 'Critical', bg: 'bg-red-100', text: 'text-red-800' };
    case 'warning':
      return { emoji: '🟠', label: 'Warning', bg: 'bg-amber-100', text: 'text-amber-800' };
    case 'info':
      return { emoji: '🔵', label: 'Info', bg: 'bg-blue-100', text: 'text-blue-800' };
    default:
      return { emoji: '⚪', label: 'Unknown', bg: 'bg-gray-100', text: 'text-gray-800' };
  }
}

export default function VPPortfolio({ workspaceId }: VPPortfolioProps) {
  const [teams, setTeams] = useState<TeamAggregate[]>([]);
  const [warnings, setWarnings] = useState<EarlyWarning[]>([]);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/vp/portfolio?workspaceId=${workspaceId}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch portfolio');
        }

        const data = await response.json();
        setTeams(data.teams || []);
        setWarnings(data.warnings || []);
        setSnapshot(data.snapshot);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load portfolio'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error loading portfolio</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const trendConfig = snapshot ? getTrendConfig(snapshot.trend) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">📊 Executive Dashboard</h1>
        <p className="text-gray-600">
          Organization-wide performance portfolio and team health indicators
        </p>
      </div>

      {/* Workspace Overview */}
      {snapshot && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Total Developers</div>
            <div className="text-3xl font-bold text-gray-900">
              {snapshot.total_developers}
            </div>
            <div className="text-xs text-gray-500 mt-2">across {snapshot.total_teams} teams</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Avg 30-Day Score</div>
            <div className="text-3xl font-bold text-gray-900">
              {snapshot.avg_score_30d !== null
                ? Math.round(snapshot.avg_score_30d)
                : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {snapshot.total_prs_30d} PRs reviewed
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Team Health</div>
            <div className="flex gap-2 mt-2">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {snapshot.teams_improving}
                </div>
                <div className="text-xs text-gray-600">Improving</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-600">
                  {snapshot.teams_stable}
                </div>
                <div className="text-xs text-gray-600">Stable</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">
                  {snapshot.teams_declining}
                </div>
                <div className="text-xs text-gray-600">Declining</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Org Trend</div>
            <div className={`text-2xl mb-2 ${trendConfig?.color}`}>
              {trendConfig?.emoji}
            </div>
            <div className="font-semibold text-gray-900">
              {trendConfig?.label}
            </div>
            {snapshot.critical_warnings > 0 && (
              <div className="text-xs text-red-600 mt-2">
                {snapshot.critical_warnings} critical alerts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Early Warnings */}
      {warnings.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            ⚠️ Early Warnings
          </h2>

          <div className="space-y-3">
            {warnings.map((warning) => {
              const severityConfig = getSeverityConfig(warning.severity);
              return (
                <div
                  key={warning.id}
                  className={`${severityConfig.bg} rounded-lg p-4 border border-gray-200`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{severityConfig.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold ${severityConfig.text}`}>
                          {warning.title}
                        </h3>
                        <span className="text-xs font-medium px-2 py-1 rounded bg-white">
                          {warning.team_name}
                        </span>
                      </div>
                      {warning.description && (
                        <p className={`text-sm ${severityConfig.text}`}>
                          {warning.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teams Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            🏆 Team Performance ({teams.length} teams)
          </h2>
        </div>

        {teams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    30-Day Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Quality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Developers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    PRs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teams.map((team) => {
                  const trendCfg = getTrendConfig(team.trend);
                  return (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {team.team_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-semibold text-gray-900">
                          {team.overall_score_30d !== null
                            ? Math.round(team.overall_score_30d)
                            : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {team.avg_code_quality_30d !== null
                          ? Math.round(team.avg_code_quality_30d)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {team.avg_bug_risk_30d !== null
                          ? Math.round(100 - team.avg_bug_risk_30d)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {team.developer_count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {team.total_prs_30d}
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${trendCfg.color}`}>
                        {trendCfg.emoji} {trendCfg.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-600">
            No team data yet. Teams will appear here once they have development activity.
          </div>
        )}
      </div>

      {/* Coming Soon */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">🚀 Coming Soon</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Individual team deep-dives with drill-down capability</li>
          <li>✓ Historical trend analysis (quarterly snapshots)</li>
          <li>✓ Peer benchmarking across teams</li>
          <li>✓ Retention and engagement signals</li>
          <li>✓ Custom goal tracking and alerts</li>
        </ul>
      </div>
    </div>
  );
}
