'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface FeedbackItem {
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension?: string;
  title: string;
  description: string;
  file_path?: string;
  line_number?: number;
}

interface Dimensions {
  code_quality: number | null;
  bug_risk: number | null;
  architecture: number | null;
  test_coverage: number | null;
}

interface Quest {
  id: string;
  type: FeedbackItem['type'];
  title: string;
  description: string;
  pr_number: number;
}

interface LatestCoaching {
  pr_number: number;
  pr_title: string;
  headline: string;
  tag: string | null;
  body: string;
}

interface DashboardData {
  firstName: string;
  overallScore: number;
  scoreCount30d: number;
  winsLogged: number;
  confident: boolean;
  dimensions: Dimensions;
  momentum: { label: string; arrow: string; color: string };
  streak: boolean[]; // Mon..Sun, true = a PR was merged that day this week
  quests: Quest[];
  latestCoaching: LatestCoaching | null;
}

// 30-day rolling color ramp, shared by the growth score and each
// dimension bar. Bug-risk is passed pre-inverted (control = 100 - risk)
// so higher always means better here.
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, display_name')
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        setError('No workspace membership');
        setLoading(false);
        return;
      }

      const firstName =
        (membership.display_name || user.email || 'there').split(/[\s@]/)[0];

      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: prList } = await supabase
        .from('pull_requests')
        .select(
          `
          id, number, title, merged_at,
          pr_scores(code_quality, bug_risk, architecture, test_coverage, overall_assessment, feedback)
        `
        )
        .eq('workspace_id', membership.workspace_id)
        .eq('developer_id', user.id)
        .order('merged_at', { ascending: false })
        .limit(30);

      const prs = (prList || []).map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        score: pr.pr_scores?.[0] as
          | {
              code_quality: number;
              bug_risk: number;
              architecture: number;
              test_coverage: number;
              overall_assessment: string | null;
              feedback: FeedbackItem[] | null;
            }
          | undefined,
      }));

      const scored = prs.filter((pr) => pr.score);
      const scored30 = scored.filter((pr) => pr.merged_at >= thirtyDaysAgo);

      // ---- Dimensions (30-day rolling average) ----
      const avg = (
        key: 'code_quality' | 'bug_risk' | 'architecture' | 'test_coverage'
      ) =>
        scored30.length
          ? scored30.reduce((s, pr) => s + (pr.score![key] || 0), 0) /
            scored30.length
          : null;

      const dimensions: Dimensions = {
        code_quality: avg('code_quality'),
        bug_risk: avg('bug_risk'),
        architecture: avg('architecture'),
        test_coverage: avg('test_coverage'),
      };

      const overallScore =
        scored30.length && dimensions.code_quality !== null
          ? Math.round(
              (dimensions.code_quality +
                (100 - (dimensions.bug_risk ?? 0)) +
                (dimensions.architecture ?? 0) +
                (dimensions.test_coverage ?? 0)) /
                4
            )
          : 0;

      // ---- Wins logged (GOOD feedback items in last 30 days) ----
      const winsLogged = scored30.reduce(
        (n, pr) => n + (pr.score!.feedback || []).filter((f) => f.type === 'GOOD').length,
        0
      );

      // ---- Momentum: recent half vs older half of scored PRs ----
      let momentum = { label: 'building', arrow: '·', color: 'var(--ink-3)' };
      const overallOf = (pr: (typeof scored)[number]) =>
        (pr.score!.code_quality +
          (100 - pr.score!.bug_risk) +
          pr.score!.architecture +
          pr.score!.test_coverage) /
        4;
      if (scored.length >= 4) {
        const mid = Math.floor(scored.length / 2);
        const recent = scored.slice(0, mid);
        const older = scored.slice(mid);
        const avgOf = (arr: typeof scored) =>
          arr.reduce((s, pr) => s + overallOf(pr), 0) / arr.length;
        const diff = avgOf(recent) - avgOf(older);
        if (diff > 3) momentum = { label: 'improving', arrow: '▲', color: 'var(--good)' };
        else if (diff < -3) momentum = { label: 'watch', arrow: '▼', color: 'var(--bad)' };
        else momentum = { label: 'steady', arrow: '—', color: 'var(--ink-2)' };
      }

      // ---- This-week coaching streak (Mon..Sun) ----
      const streak = [false, false, false, false, false, false, false];
      const startOfWeek = new Date();
      const dow = (startOfWeek.getDay() + 6) % 7; // 0 = Monday
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - dow);
      prs.forEach((pr) => {
        if (!pr.merged_at) return;
        const d = new Date(pr.merged_at);
        if (d >= startOfWeek) {
          const idx = (d.getDay() + 6) % 7;
          streak[idx] = true;
        }
      });

      // ---- Active growth quests (actionable feedback, most recent PRs) ----
      const quests: Quest[] = scored
        .flatMap((pr) =>
          (pr.score!.feedback || [])
            .filter((f) => f.type !== 'GOOD')
            .map((f, i) => ({
              id: `${pr.id}-${i}`,
              type: f.type,
              title: f.title,
              description: f.description,
              pr_number: pr.number,
            }))
        )
        .slice(0, 3);

      // ---- Latest coaching (most recent scored PR) ----
      let latestCoaching: LatestCoaching | null = null;
      const latest = scored[0];
      if (latest) {
        const fb = latest.score!.feedback || [];
        const lead = fb.find((f) => f.type !== 'GOOD') || fb[0];
        latestCoaching = {
          pr_number: latest.number,
          pr_title: latest.title,
          headline:
            lead?.title ||
            latest.score!.overall_assessment ||
            'Reviewed — nothing urgent flagged',
          tag: lead?.dimension || null,
          body:
            latest.score!.overall_assessment ||
            lead?.description ||
            'No detailed notes for this PR.',
        };
      }

      setData({
        firstName,
        overallScore,
        scoreCount30d: scored30.length,
        winsLogged,
        confident: scored30.length >= 3,
        dimensions,
        momentum,
        streak,
        quests,
        latestCoaching,
      });
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: 'var(--ink-3)' }}>Loading your growth data…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: 'var(--bad)' }}>{error || 'No data'}</p>
      </div>
    );
  }

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
              Good to see you, {data.firstName} 🌱
            </h1>
            <p className="text-[15px] mt-1.5" style={{ color: 'var(--ink-2)' }}>
              You&apos;re not being ranked — you&apos;re being coached. Here&apos;s what
              your recent PRs say about how you&apos;re growing.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div
              className="text-3xl font-semibold leading-none"
              style={{ color: rampColor(data.overallScore || null) }}
            >
              {data.overallScore || '—'}
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
              {data.streak.map((on, i) => (
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
              {data.scoreCount30d} PR{data.scoreCount30d !== 1 ? 's' : ''} ·{' '}
              {data.winsLogged} win{data.winsLogged !== 1 ? 's' : ''} logged
            </div>
          </div>
          <div>
            <div className="text-[11px] mb-2" style={{ color: 'var(--ink-3)' }}>
              Momentum
            </div>
            <div className="text-[15px]" style={{ color: data.momentum.color }}>
              {data.momentum.arrow} {data.momentum.label}
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
          <DimensionBar label="Code quality" value={data.dimensions.code_quality} />
          <DimensionBar
            label="Bug-risk control"
            value={
              data.dimensions.bug_risk !== null
                ? 100 - data.dimensions.bug_risk
                : null
            }
          />
          <DimensionBar label="Architecture" value={data.dimensions.architecture} />
          <DimensionBar label="Test coverage" value={data.dimensions.test_coverage} />
        </div>
        {!data.confident && (
          <p className="text-[12px] mt-4" style={{ color: 'var(--amber)' }}>
            ⚠️ Low confidence — score more PRs for reliable insights.
          </p>
        )}
      </section>

      {/* Active growth quests */}
      {data.quests.length > 0 && (
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
            {data.quests.map((q) => (
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

      {/* Latest coaching */}
      {data.latestCoaching && (
        <section
          className="rounded-[14px] p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <SectionHeader>
            Latest coaching · PR #{data.latestCoaching.pr_number}{' '}
            <span style={{ textTransform: 'none' }}>
              “{data.latestCoaching.pr_title}”
            </span>
          </SectionHeader>

          <div
            className="rounded-[12px] p-5 mt-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-lg flex-shrink-0">🤖</span>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {data.latestCoaching.headline}
                </p>
              </div>
              {data.latestCoaching.tag && (
                <span
                  className="text-[11px] font-medium flex-shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--sage-soft)', color: 'var(--sage-ink)' }}
                >
                  {data.latestCoaching.tag}
                </span>
              )}
            </div>
            <p className="text-[13px] mt-3" style={{ color: 'var(--ink-2)' }}>
              {data.latestCoaching.body}
            </p>

            <div
              className="flex flex-wrap items-center gap-2 mt-4 pt-4"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              {['📄 Text', '🔊 Voice', '🎬 Video walkthrough'].map((t) => (
                <span
                  key={t}
                  className="text-[12px] px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                >
                  {t}
                </span>
              ))}
              <span className="flex-1" />
              <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                👍 Helpful
              </span>
              <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                👎
              </span>
            </div>
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
