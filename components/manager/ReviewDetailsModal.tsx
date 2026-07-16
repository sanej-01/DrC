'use client';

import { useEffect, useRef } from 'react';

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
  dimensions: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  overall_assessment: string | null;
  feedback: FeedbackItem[];
}

interface ReviewDetailsModalProps {
  reviews: ReviewDetail[];
  onClose: () => void;
}

const TYPE_CONFIG: Record<FeedbackItem['type'], { label: string; color: string; bg: string; border: string }> = {
  FIX:     { label: 'Fix',       color: 'var(--bad)',    bg: '#fdf2f2', border: '#f5c6c6' },
  IMPROVE: { label: 'Improve',   color: 'var(--teal)',   bg: '#f0f7f7', border: '#b8dada' },
  SUGGEST: { label: 'Suggest',   color: 'var(--amber)',  bg: '#fdf8ec', border: '#f0dfa0' },
  GOOD:    { label: 'Well done', color: 'var(--good)',   bg: '#f0f8f4', border: '#b8dfc9' },
};

const DIM_LABEL: Record<string, string> = {
  code_quality: 'Code quality',
  bug_risk: 'Bug risk',
  architecture: 'Architecture',
  test_coverage: 'Test coverage',
};

function scoreColor(v: number): string {
  if (v >= 85) return 'var(--good)';
  if (v >= 70) return 'var(--teal)';
  if (v >= 55) return 'var(--amber)';
  return 'var(--bad)';
}

export default function ReviewDetailsModal({ reviews, onClose }: ReviewDetailsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(43,51,47,0.45)' }}
      onClick={handleBackdrop}
    >
      <div
        ref={panelRef}
        className="relative flex flex-col w-full sm:max-w-2xl rounded-t-[20px] sm:rounded-[20px] overflow-hidden"
        style={{
          background: 'var(--bg)',
          maxHeight: '88vh',
          boxShadow: '0 8px 48px rgba(43,51,47,0.18)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}
        >
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>
              LLM Score Breakdown
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {reviews.length} PR{reviews.length !== 1 ? 's' : ''} · all validations, code review &amp; scoring logic
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center w-8 h-8 rounded-full text-[18px] leading-none"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {reviews.length === 0 && (
            <p className="text-[14px] text-center py-12" style={{ color: 'var(--ink-3)' }}>
              No scored PRs yet.
            </p>
          )}
          {reviews.map((r) => (
            <div
              key={r.pr_number}
              className="rounded-[14px] overflow-hidden"
              style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
            >
              {/* PR header */}
              <div
                className="flex items-start justify-between gap-3 px-5 py-4"
                style={{ borderBottom: '1px solid var(--line)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>
                      PR #{r.pr_number}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {new Date(r.merged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {r.pr_title}
                  </p>
                </div>
                <div
                  className="flex-shrink-0 text-right px-3 py-2 rounded-[10px]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
                >
                  <div className="text-[22px] font-bold leading-none" style={{ color: scoreColor(r.overall_score) }}>
                    {r.overall_score}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>score</div>
                </div>
              </div>

              {/* Dimension scores */}
              <div
                className="grid grid-cols-4 divide-x px-0"
                style={{ borderBottom: '1px solid var(--line)', borderColor: 'var(--line)' }}
              >
                {([
                  ['code_quality', r.dimensions.code_quality],
                  ['bug_risk', r.dimensions.bug_risk],
                  ['architecture', r.dimensions.architecture],
                  ['test_coverage', r.dimensions.test_coverage],
                ] as [string, number | null][]).map(([key, val]) => (
                  <div key={key} className="px-4 py-3 text-center" style={{ borderColor: 'var(--line)' }}>
                    <div className="text-[11px] mb-1" style={{ color: 'var(--ink-3)' }}>
                      {DIM_LABEL[key]}
                    </div>
                    <div className="text-[15px] font-semibold" style={{ color: val !== null ? scoreColor(key === 'bug_risk' ? 100 - val : val) : 'var(--ink-3)' }}>
                      {val !== null ? Math.round(key === 'bug_risk' ? 100 - val : val) : '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall assessment */}
              {r.overall_assessment && (
                <div className="px-5 py-4" style={{ borderBottom: r.feedback.length > 0 ? '1px solid var(--line)' : undefined }}>
                  <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--ink-3)', letterSpacing: '0.07em' }}>
                    LLM Assessment
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {r.overall_assessment}
                  </p>
                </div>
              )}

              {/* Feedback items */}
              {r.feedback.length > 0 && (
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: 'var(--ink-3)', letterSpacing: '0.07em' }}>
                    Code Review Items ({r.feedback.length})
                  </p>
                  {(['FIX', 'IMPROVE', 'SUGGEST', 'GOOD'] as const).map((type) => {
                    const items = r.feedback.filter((f) => f.type === type);
                    if (items.length === 0) return null;
                    const cfg = TYPE_CONFIG[type];
                    return (
                      <div key={type}>
                        {items.map((item, i) => (
                          <div
                            key={i}
                            className="rounded-[10px] px-4 py-3 mb-2"
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
                              <p className="text-[11px] mt-2 font-mono" style={{ color: 'var(--ink-3)' }}>
                                {item.file_path}{item.line_number ? `:${item.line_number}` : ''}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
