'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface FeedbackItem {
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension: string;
  title: string;
  description: string;
  file_path?: string;
  line_number?: number;
}

interface PRScore {
  code_quality: number;
  bug_risk: number;
  architecture: number;
  test_coverage: number;
  overall_score: number;
  overall_assessment: string | null;
  feedback: FeedbackItem[];
  scored_at: string;
}

interface PRDetail {
  id: string;
  number: number;
  title: string;
  url: string;
  author_github_handle: string;
  author_display_name: string | null;
  merged_at: string;
  additions_count: number;
  deletions_count: number;
  files_changed_count: number;
  repo_name: string | null;
  score: PRScore | null;
}

interface PRDetailsListProps {
  workspaceId: string;
  refreshKey?: number;
  onDataLoaded?: (count: number) => void;
}

const TYPE_CONFIG: Record<FeedbackItem['type'], { label: string; color: string; bg: string; border: string }> = {
  FIX:     { label: 'Fix',       color: 'var(--bad)',   bg: '#fdf2f2', border: '#f5c6c6' },
  IMPROVE: { label: 'Improve',   color: 'var(--teal)',  bg: '#f0f7f7', border: '#b8dada' },
  SUGGEST: { label: 'Suggest',   color: 'var(--amber)', bg: '#fdf8ec', border: '#f0dfa0' },
  GOOD:    { label: 'Well done', color: 'var(--good)',  bg: '#f0f8f4', border: '#b8dfc9' },
};

const DIM_LABEL: Record<string, string> = {
  code_quality:  'Code quality',
  bug_risk:      'Bug risk',
  architecture:  'Architecture',
  test_coverage: 'Test coverage',
};

function scoreColor(v: number): string {
  if (v >= 85) return 'var(--good)';
  if (v >= 70) return 'var(--teal)';
  if (v >= 55) return 'var(--amber)';
  return 'var(--bad)';
}

function overallOf(s: PRScore): number {
  return Math.round(
    (s.code_quality + (100 - s.bug_risk) + s.architecture + s.test_coverage) / 4
  );
}

function PRCard({ pr }: { pr: PRDetail }) {
  const score = pr.score;
  const overallScore = score ? overallOf(score) : null;
  const author = pr.author_display_name || pr.author_github_handle;

  return (
    <div
      className="rounded-[12px] overflow-hidden mt-5"
      style={{ border: '1px solid var(--line)' }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
              onClick={(e) => e.stopPropagation()}
            >
              PR #{pr.number}
            </a>
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {new Date(pr.merged_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          </div>
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {pr.title}
          </p>
          {/* Metadata: repo · author · N files */}
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
            {pr.repo_name && (
              <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>
                {pr.repo_name} ·{' '}
              </span>
            )}
            {author} · {pr.files_changed_count} files{' '}
            (<span style={{ color: 'var(--good)' }}>+{pr.additions_count}</span>{' '}
            <span style={{ color: 'var(--bad)' }}>-{pr.deletions_count}</span>)
          </p>
        </div>
        {overallScore !== null && (
          <div
            className="flex-shrink-0 text-right px-3 py-1.5 rounded-[8px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div
              className="text-[20px] font-bold leading-none"
              style={{ color: scoreColor(overallScore) }}
            >
              {overallScore}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>score</div>
          </div>
        )}
        {!score && (
          <span className="text-[11px] italic" style={{ color: 'var(--ink-3)' }}>
            not scored
          </span>
        )}
      </div>

      {score && (
        <>
          {/* Dimension scores */}
          <div
            className="grid grid-cols-4"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            {(['code_quality', 'bug_risk', 'architecture', 'test_coverage'] as const).map((key, idx) => {
              const raw = score[key];
              const val = key === 'bug_risk' ? 100 - raw : raw;
              return (
                <div
                  key={key}
                  className="px-3 py-2.5 text-center"
                  style={{ borderLeft: idx > 0 ? '1px solid var(--line)' : undefined }}
                >
                  <div className="text-[10px] mb-1" style={{ color: 'var(--ink-3)' }}>
                    {DIM_LABEL[key]}
                  </div>
                  <div className="text-[14px] font-semibold" style={{ color: scoreColor(val) }}>
                    {Math.round(val)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LLM Assessment */}
          {score.overall_assessment && (
            <div
              className="px-4 py-3"
              style={{ borderBottom: score.feedback && score.feedback.length > 0 ? '1px solid var(--line)' : undefined }}
            >
              <p
                className="text-[10px] font-semibold uppercase mb-1.5"
                style={{ color: 'var(--ink-3)', letterSpacing: '0.07em' }}
              >
                LLM Assessment
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {score.overall_assessment}
              </p>
            </div>
          )}

          {/* Feedback items */}
          {score.feedback && score.feedback.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p
                className="text-[10px] font-semibold uppercase mb-2"
                style={{ color: 'var(--ink-3)', letterSpacing: '0.07em' }}
              >
                Code Review ({score.feedback.length})
              </p>
              {(['FIX', 'IMPROVE', 'SUGGEST', 'GOOD'] as const).map((type) => {
                const items = score.feedback.filter((f) => f.type === type);
                if (items.length === 0) return null;
                const cfg = TYPE_CONFIG[type];
                return items.map((item, i) => (
                  <div
                    key={`${type}-${i}`}
                    className="rounded-[8px] px-3 py-2.5"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                        style={{ color: cfg.color, background: 'rgba(255,255,255,0.7)' }}
                      >
                        {cfg.label}
                      </span>
                      {item.dimension && (
                        <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                          {item.dimension}
                        </span>
                      )}
                    </div>
                    {item.title && (
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                        {item.title}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                        {item.description}
                      </p>
                    )}
                    {item.file_path && (
                      <p className="text-[11px] mt-1.5 font-mono" style={{ color: 'var(--ink-3)' }}>
                        {item.file_path}{item.line_number ? `:${item.line_number}` : ''}
                      </p>
                    )}
                  </div>
                ));
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PRDetailsList({ workspaceId, refreshKey, onDataLoaded }: PRDetailsListProps) {
  const [prs, setPrs] = useState<PRDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await authedFetch(
          `/api/manager/team/pr-details?workspace_id=${workspaceId}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load PR details');
        }

        const data = await response.json();
        setPrs(data.prs || []);
        onDataLoaded?.((data.prs || []).length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PR details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
    // onDataLoaded intentionally excluded — it's a parent callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, refreshKey]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 pt-4">
        <div className="h-28 rounded-[12px]" style={{ background: 'var(--line)' }} />
        <div className="h-28 rounded-[12px]" style={{ background: 'var(--line)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-4 rounded-[10px] text-[13px] mt-4"
        style={{ background: '#fdf2f2', border: '1px solid #f5c6c6', color: 'var(--bad)' }}
      >
        {error}
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <p className="text-[14px] text-center py-8" style={{ color: 'var(--ink-3)' }}>
        No PRs yet. Run &quot;Scan GitHub Now&quot; to pull in merged pull requests.
      </p>
    );
  }

  // Group by repo when multiple repos present
  const repoNames = [...new Set(prs.map((p) => p.repo_name).filter(Boolean))] as string[];
  const showGroups = repoNames.length > 1;

  const grouped: Array<{ repoName: string; prs: PRDetail[] }> = showGroups
    ? repoNames.map((name) => ({ repoName: name, prs: prs.filter((p) => p.repo_name === name) }))
    : [{ repoName: '', prs }];

  return (
    <div>
      {grouped.map(({ repoName, prs: group }) => (
        <div key={repoName || 'all'}>
          {showGroups && (
            <div className="flex items-center gap-3 mt-6 mb-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[6px]"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
              >
                {repoName}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {group.length} PR{group.length !== 1 ? 's' : ''}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--line)' }} />
            </div>
          )}
          {group.map((pr) => (
            <PRCard key={pr.id} pr={pr} />
          ))}
        </div>
      ))}
    </div>
  );
}
