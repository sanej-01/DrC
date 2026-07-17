'use client';

import { useState } from 'react';

interface FeedbackItem {
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension: string | null;
  title: string | null;
  description: string | null;
  file_path: string | null;
  line_number: number | null;
}

interface ReviewDetail {
  pr_number: number;
  pr_title: string;
  merged_at: string;
  overall_score: number;
  repo_name?: string | null;
  dimensions: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  overall_assessment: string | null;
  feedback: FeedbackItem[];
}

interface PRDetailsAccordionProps {
  reviews: ReviewDetail[];
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

function PRCard({ r }: { r: ReviewDetail }) {
  return (
    <div
      className="rounded-[12px] overflow-hidden mt-5"
      style={{ border: '1px solid var(--line)' }}
    >
      {/* PR header */}
      <div
        className="flex items-start justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
            >
              PR #{r.pr_number}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {new Date(r.merged_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          </div>
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {r.pr_title}
          </p>
        </div>
        <div
          className="flex-shrink-0 text-right px-3 py-1.5 rounded-[8px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div className="text-[20px] font-bold leading-none" style={{ color: scoreColor(r.overall_score) }}>
            {r.overall_score}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>score</div>
        </div>
      </div>

      {/* Dimension scores */}
      <div
        className="grid grid-cols-4"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {(['code_quality', 'bug_risk', 'architecture', 'test_coverage'] as const).map((key, idx) => {
          const raw = r.dimensions[key];
          const val = key === 'bug_risk' && raw !== null ? 100 - raw : raw;
          return (
            <div
              key={key}
              className="px-3 py-2.5 text-center"
              style={{ borderLeft: idx > 0 ? '1px solid var(--line)' : undefined }}
            >
              <div className="text-[10px] mb-1" style={{ color: 'var(--ink-3)' }}>
                {DIM_LABEL[key]}
              </div>
              <div
                className="text-[14px] font-semibold"
                style={{ color: val !== null ? scoreColor(val) : 'var(--ink-3)' }}
              >
                {val !== null ? Math.round(val) : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall assessment */}
      {r.overall_assessment && (
        <div
          className="px-4 py-3"
          style={{ borderBottom: r.feedback.length > 0 ? '1px solid var(--line)' : undefined }}
        >
          <p className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: 'var(--ink-3)', letterSpacing: '0.07em' }}>
            LLM Assessment
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {r.overall_assessment}
          </p>
        </div>
      )}

      {/* Feedback items */}
      {r.feedback.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase mb-2" style={{ color: 'var(--ink-3)', letterSpacing: '0.07em' }}>
            Code Review ({r.feedback.length})
          </p>
          {(['FIX', 'IMPROVE', 'SUGGEST', 'GOOD'] as const).map((type) => {
            const items = r.feedback.filter((f) => f.type === type);
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
    </div>
  );
}

export default function PRDetailsAccordion({ reviews }: PRDetailsAccordionProps) {
  const [open, setOpen] = useState(false);

  // Group by project when more than one distinct repo is present
  const repoNames = [...new Set(reviews.map((r) => r.repo_name).filter(Boolean))] as string[];
  const showProjectGroups = repoNames.length > 1;

  const grouped: Array<{ repoName: string; prs: ReviewDetail[] }> = showProjectGroups
    ? repoNames.map((name) => ({ repoName: name, prs: reviews.filter((r) => r.repo_name === name) }))
    : [{ repoName: '', prs: reviews }];

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
    >
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: 'var(--surface)' }}
      >
        <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
          PR Details
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {reviews.length} PR{reviews.length !== 1 ? 's' : ''}
            {showProjectGroups ? ` · ${repoNames.length} projects` : ' · LLM analysis'}
          </span>
          <span
            className="text-[16px] transition-transform duration-200"
            style={{
              color: 'var(--ink-3)',
              display: 'inline-block',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div
          className="px-5 pb-5"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          {reviews.length === 0 && (
            <p className="text-[14px] text-center py-8" style={{ color: 'var(--ink-3)' }}>
              No scored PRs yet.
            </p>
          )}

          {grouped.map(({ repoName, prs }) => (
            <div key={repoName || 'all'}>
              {showProjectGroups && (
                <div
                  className="flex items-center gap-3 mt-6 mb-1"
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[6px]"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                  >
                    {repoName}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {prs.length} PR{prs.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--line)' }} />
                </div>
              )}
              {prs.map((r) => (
                <PRCard key={r.pr_number} r={r} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
