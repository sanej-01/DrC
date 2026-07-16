'use client';

/**
 * GardenVisualization — Phase 6.1
 * Team garden showing each developer as a plant at different growth stages
 * Stages: flourishing, mature, sapling, seedling, no_data
 */

import { useRouter } from 'next/navigation';

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

interface GardenVisualizationProps {
  members: TeamMember[];
  stats: {
    total_members: number;
    members_with_data: number;
    members_no_data: number;
    stage_breakdown: Record<string, number>;
    avg_score_30d: number | null;
  };
  workspaceId: string;
}

function getStageConfig(stage: string) {
  switch (stage) {
    case 'flourishing':
      return {
        emoji: '🌲',
        label: 'Flourishing',
        description: '85+ score',
        color: 'from-green-100 to-green-50',
        border: 'border-green-300',
        badge: 'bg-green-100 text-green-800',
      };
    case 'mature':
      return {
        emoji: '🌳',
        label: 'Mature',
        description: '70-84 score',
        color: 'from-emerald-100 to-emerald-50',
        border: 'border-emerald-300',
        badge: 'bg-emerald-100 text-emerald-800',
      };
    case 'sapling':
      return {
        emoji: '🌿',
        label: 'Sapling',
        description: '40-69 score',
        color: 'from-yellow-100 to-yellow-50',
        border: 'border-yellow-300',
        badge: 'bg-yellow-100 text-yellow-800',
      };
    case 'seedling':
      return {
        emoji: '🌱',
        label: 'Seedling',
        description: 'Building (< 40 score, or fewer than 3 PRs scored)',
        color: 'from-blue-100 to-blue-50',
        border: 'border-blue-300',
        badge: 'bg-blue-100 text-blue-800',
      };
    case 'no_data':
      return {
        emoji: '🚫',
        label: 'No Data',
        description: 'No PRs yet',
        color: 'from-gray-100 to-gray-50',
        border: 'border-gray-300',
        badge: 'bg-gray-100 text-gray-800',
      };
    default:
      return {
        emoji: '❓',
        label: 'Unknown',
        description: 'Unknown stage',
        color: 'from-gray-100 to-gray-50',
        border: 'border-gray-300',
        badge: 'bg-gray-100 text-gray-800',
      };
  }
}

export default function GardenVisualization({
  members,
  stats,
  workspaceId,
}: GardenVisualizationProps) {
  const router = useRouter();
  // Group members by stage
  const membersByStage = {
    flourishing: members.filter((m) => m.stage === 'flourishing'),
    mature: members.filter((m) => m.stage === 'mature'),
    sapling: members.filter((m) => m.stage === 'sapling'),
    seedling: members.filter((m) => m.stage === 'seedling'),
    no_data: members.filter((m) => m.stage === 'no_data'),
  };

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Members</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.total_members}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">With Data</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.members_with_data}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Avg 30-day Score</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.avg_score_30d !== null ? Math.round(stats.avg_score_30d) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">No Data</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.members_no_data}
          </div>
        </div>
      </div>

      {/* Stage Legend */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Growth Stages</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['flourishing', 'mature', 'sapling', 'seedling', 'no_data'] as const).map((stage) => {
            const config = getStageConfig(stage);
            const count = stats.stage_breakdown[stage];
            return (
              <div
                key={stage}
                className={`rounded-lg border ${config.border} ${config.color} bg-gradient-to-br p-4 text-center`}
              >
                <div className="text-3xl mb-2">{config.emoji}</div>
                <div className="font-semibold text-sm text-gray-900">
                  {config.label}
                </div>
                <div className="text-xs text-gray-600">{count} members</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Garden Grid */}
      <div className="space-y-8">
        {(['flourishing', 'mature', 'sapling', 'seedling', 'no_data'] as const).map((stage) => {
          const stageMembers = membersByStage[stage];
          if (stageMembers.length === 0) return null;

          const config = getStageConfig(stage);

          return (
            <div key={stage}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{config.emoji}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {config.label} ({stageMembers.length})
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stageMembers.map((member) => (
                  <div
                    key={member.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/manager/team/${member.id}?workspace_id=${workspaceId}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        router.push(`/manager/team/${member.id}?workspace_id=${workspaceId}`);
                      }
                    }}
                    className={`rounded-lg border ${config.border} bg-gradient-to-br ${config.color} p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {member.display_name}
                        </h4>
                        <p className="text-xs text-gray-600 truncate">
                          {member.github_handle && `@${member.github_handle}`}
                        </p>
                      </div>
                      {member.score_30d !== null && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-bold text-gray-900">
                            {member.score_30d}%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    {member.stage !== 'no_data' && (
                      <div className="space-y-2 mb-4 pt-3 pb-4 border-t border-gray-200/50">
                        <div className="text-xs text-gray-700">
                          <div className="flex justify-between">
                            <span>Quality</span>
                            <span className="font-semibold">
                              {member.dimensions.quality !== null
                                ? Math.round(member.dimensions.quality)
                                : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-700">
                          <div className="flex justify-between">
                            <span>Risk</span>
                            <span className="font-semibold">
                              {member.dimensions.bug_risk !== null
                                ? Math.round(100 - member.dimensions.bug_risk)
                                : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-700">
                          <div className="flex justify-between">
                            <span>Architecture</span>
                            <span className="font-semibold">
                              {member.dimensions.architecture !== null
                                ? Math.round(member.dimensions.architecture)
                                : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-700">
                          <div className="flex justify-between">
                            <span>Tests</span>
                            <span className="font-semibold">
                              {member.dimensions.tests !== null
                                ? Math.round(member.dimensions.tests)
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200/50 text-xs text-gray-600">
                      <div>
                        {member.pr_count > 0 ? (
                          <span>{member.pr_count} PR{member.pr_count !== 1 ? 's' : ''}</span>
                        ) : (
                          <span>No PRs</span>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded ${config.badge}`}>
                        {member.confidence === 'CONFIDENT' ? '✓' : ''}
                        {member.confidence === 'LOW_CONFIDENCE' ? '⚠️' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
