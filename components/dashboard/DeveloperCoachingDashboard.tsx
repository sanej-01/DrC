'use client';

/**
 * Developer Coaching Dashboard — shared layout for /dashboard and
 * /manager/team/[developerId] drill-down. Same hero + dimensions +
 * quests + coaching structure, different data sources.
 */

import CoachingCard, { CoachingCardItem } from './CoachingCard';

interface FeedbackItem {
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension?: string;
  title: string;
  description: string;
  file_path?: string;
  line_number?: number;
}

interface DashboardProps {
  firstName: string;
  overallScore: number;
  scoreCount30d: number;
  winsLogged: number;
  confident: boolean;
  dimensions: {
    code_quality: number | null;
    bug_risk: number | null;
    architecture: number | null;
    test_coverage: number | null;
  };
  momentum: { label: string; arrow: string; color: string };
  streak: boolean[];
  quests: Array<{
    id: string;
    type: FeedbackItem['type'];
    title: string;
    description: string;
    pr_number: number;
  }>;
  coachingItems: CoachingCardItem[];
}

function rampColor(v: number | null): string {
  if (v === null) return 'var(--ink-3)';
  if (v >= 85) return 'var(--good)';
  if (v >= 70) return 'var(--teal)';
  if (v >= 55) return 'var(--amber)';
  return 'var(--bad)';
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const QUEST_ICONS: Record<FeedbackItem['type'], string> = {
  FIX: '🛡️',
  IMPROVE: '🔧',
  SUGGEST: '📐',
  GOOD: '✨',
};

export default function DeveloperCoachingDashboard(props: DashboardProps) {
  const {
    firstName,
    overallScore,
    scoreCount30d,
    winsLogged,
    confident,
    dimensions,
    momentum,
    streak,
    quests,
    coachingItems,
  } = props;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-5">
      {/* Hero card */}
      <section
        className="rounded-[14px] p-6"
        style={{ border: '1px solid var(--line)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium"
              style={{ color: 'var(--sage-ink)' }}
            >
              🔒 Private to you &amp; your manager
            </span>
            <h1
              className="text-[23px] font-bold mt-2"
              style={{ color: 'var(--ink)', letterSpacing: '-0.4px' }}
            >
              Good to see you, {firstName} 🌱
            </h1>
            <p className="text-[15px] mt-1.5" style={{ color: 'var(--ink-2)' }}>
              You&apos;re being coached. Your recent PRs show your growing.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div
              className="text-3xl font-semibold leading-none"
              style={{ color: rampColor(overallScore || null) }}
            >
              {overallScore || '—'}
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
              growth score
            </div>
          </div>
        </div>

        {/* Streak / sprint / momentum */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6 pt-5"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <div>
            <div className="text-[11px] mb-2" style={{ color: 'var(--ink-3)' }}>
              Coaching streak
            </div>
            <div className="flex gap-1.5">
              {streak.map((on, i) => (
                <i
                  key={i}
                  className="grid place-items-center w-6 h-6 rounded-full text-[11px] not-italic font-medium"
                  style={{
                    background: on ? 'var(--sage)' : 'var(--sage-soft)',
                    color: on ? '#fff' : 'var(--ink-3)',
                  }}
                >
                  {DAY_LABELS[i]}
                </i>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] mb-2" style={{ color: 'var(--ink-3)' }}>
              This sprint
            </div>
            <div className="text-[15px]" style={{ color: 'var(--ink)' }}>
              {scoreCount30d} PR{scoreCount30d !== 1 ? 's' : ''} ·{' '}
              {winsLogged} win{winsLogged !== 1 ? 's' : ''} logged
            </div>
          </div>
          <div>
            <div className="text-[11px] mb-2" style={{ color: 'var(--ink-3)' }}>
              Momentum
            </div>
            <div className="text-[15px]" style={{ color: momentum.color }}>
              {momentum.arrow} {momentum.label}
            </div>
          </div>
        </div>
      </section>

      {/* Quality dimensions */}
      <section
        className="rounded-[14px] p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <SectionHeader>Your quality dimensions · 30-day rolling</SectionHeader>
        <div className="space-y-4 mt-4">
          <DimensionBar label="Code quality" value={dimensions.code_quality} />
          <DimensionBar
            label="Bug-risk control"
            value={
              dimensions.bug_risk !== null ? 100 - dimensions.bug_risk : null
            }
          />
          <DimensionBar label="Architecture" value={dimensions.architecture} />
          <DimensionBar label="Test coverage" value={dimensions.test_coverage} />
        </div>
        {!confident && (
          <p className="text-[12px] mt-4" style={{ color: 'var(--amber)' }}>
            ⚠️ Low confidence — score more PRs for reliable insights.
          </p>
        )}
      </section>

      {/* Active growth quests */}
      {quests.length > 0 && (
        <section
          className="rounded-[14px] p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <SectionHeader>Active growth quests</SectionHeader>
          <div className="space-y-3 mt-4">
            {quests.map((q) => (
              <div key={q.id} className="flex items-start gap-3">
                <span
                  className="grid place-items-center w-9 h-9 rounded-[10px] text-lg flex-shrink-0"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
                >
                  {QUEST_ICONS[q.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {q.title}
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
                    {q.description}
                  </div>
                </div>
                <span
                  className="text-[11px] font-medium flex-shrink-0 px-2 py-0.5 rounded-full"
                  style={{ color: 'var(--ink-3)', background: 'var(--surface-2)' }}
                >
                  PR #{q.pr_number}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coaching suggestions */}
      {coachingItems.length > 0 && (
        <section
          className="rounded-[14px] p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <SectionHeader>Coaching for you · recent PRs</SectionHeader>
          <div className="space-y-4 mt-4">
            {coachingItems.map((item, i) => (
              <CoachingCard key={`${item.pr_number}-${i}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[11px] font-semibold uppercase"
      style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}
    >
      {children}
    </h2>
  );
}

function DimensionBar({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          {label}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
          {value === null ? '—' : Math.round(value)}
        </span>
      </div>
      <div
        className="h-[7px] rounded-full overflow-hidden"
        style={{ background: 'var(--line)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: rampColor(value) }}
        />
      </div>
    </div>
  );
}
