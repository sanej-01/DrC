'use client';

/**
 * Director/VP Portfolio — org-wide quality & growth view.
 * Layout mirrors the DrCodium-1.html prototype's Director/VP tab:
 * KPI row → Teams table + Early warnings → org trend chart → outcome tiles.
 * Each workspace the signed-in user manages is shown as a team; clicking
 * a team row drops into that workspace's manager view.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/authed-fetch';

interface Team {
  workspace_id: string;
  name: string;
  quality: number | null;
  bug_risk: number | null;
  coverage: number | null;
  momentum: 'improving' | 'steady' | 'watch' | 'no_data';
  pr_count_30d: number;
  developer_count: number;
}

interface Warning {
  icon: string;
  severity: 'warning' | 'info' | 'win';
  title: string;
  description: string;
  workspace_id: string;
}

interface TrendPoint {
  label: string;
  quality: number | null;
  bug_risk: number | null;
  coverage: number | null;
  total_prs?: number;
}

interface PortfolioData {
  kpis: {
    org_quality: number | null;
    org_quality_delta: number | null;
    bug_risk: number | null;
    coaching_coverage: number | null;
    active_engineers: number;
    total_teams: number;
    total_engineers: number;
  };
  teams: Team[];
  warnings: Warning[];
  trend: TrendPoint[];
  outcomes: {
    devs_improving_pct: number | null;
    coaching_items_90d: number;
    prs_scored_90d: number;
  };
}

const MOMENTUM: Record<Team['momentum'], { label: string; arrow: string; color: string }> = {
  improving: { label: 'improving', arrow: '▲', color: 'var(--good)' },
  steady:    { label: 'steady',    arrow: '—', color: 'var(--ink-2)' },
  watch:     { label: 'watch',     arrow: '▼', color: 'var(--bad)' },
  no_data:   { label: 'no data',   arrow: '·', color: 'var(--ink-3)' },
};

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

/** Simple SVG multi-line chart for the org trend */
function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const W = 640;
  const H = 150;
  const PAD = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (trend.length > 1 ? (i / (trend.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  // Points for a given key — no minimum count requirement
  const ptsFor = (key: 'quality' | 'bug_risk' | 'coverage') =>
    trend
      .map((p, i) => ({ v: p[key], i }))
      .filter((p): p is { v: number; i: number } => p.v !== null);

  // SVG path for 2+ points; null for 0–1 (dots handle the single-point case)
  const pathFor = (pts: { v: number; i: number }[]) => {
    if (pts.length < 2) return null;
    return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  };

  const scoredSeries: { key: 'quality' | 'bug_risk' | 'coverage'; label: string; color: string }[] = [
    { key: 'quality',  label: 'org quality',       color: 'var(--sage)' },
    { key: 'bug_risk', label: 'bug-risk',           color: 'var(--clay)' },
    { key: 'coverage', label: 'coaching coverage',  color: 'var(--teal)' },
  ];

  const hasScoredData = scoredSeries.some((s) => ptsFor(s.key).length >= 1);

  // Stopgap: normalize total_prs per bucket to 0-100 when scored data is sparse
  const maxPRs = Math.max(...trend.map((p) => p.total_prs || 0));
  const activityPts = maxPRs > 0
    ? trend
        .map((p, i) => ({ v: Math.round(((p.total_prs || 0) / maxPRs) * 100), i }))
        .filter((p) => p.v > 0)
    : [];
  const showStopgap = !hasScoredData && activityPts.length >= 1;

  const noData = !hasScoredData && activityPts.length === 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* gridlines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
            stroke="var(--line)" strokeWidth="1" />
        ))}

        {/* Scored series — line + dots; dots alone for single-point series */}
        {!showStopgap && scoredSeries.map((s) => {
          const pts = ptsFor(s.key);
          if (pts.length === 0) return null;
          const d = pathFor(pts);
          return (
            <g key={s.key}>
              {d && <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />}
              {pts.map((p) => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={d ? 3 : 5} fill={s.color} />
              ))}
            </g>
          );
        })}

        {/* Stopgap: PR activity bars when no scored data */}
        {showStopgap && (() => {
          const d = pathFor(activityPts);
          return (
            <g>
              {d && (
                <path d={d} fill="none" stroke="var(--ink-3)" strokeWidth="2"
                  strokeDasharray="6 3" strokeLinecap="round" />
              )}
              {activityPts.map((p) => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={d ? 3 : 5} fill="var(--ink-3)" />
              ))}
            </g>
          );
        })()}

        {/* x labels */}
        {trend.map((p, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
            {p.label}
          </text>
        ))}

        {noData && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--ink-3)">
            No PR activity yet in the last 90 days
          </text>
        )}
      </svg>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-4 mt-2">
        {showStopgap ? (
          <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            <svg width="16" height="4" style={{ display: 'inline', verticalAlign: 'middle' }}>
              <line x1="0" y1="2" x2="16" y2="2" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            PR activity · scoring in progress
          </span>
        ) : (
          scoredSeries.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
              <i className="inline-block w-3 h-[3px] rounded-full not-italic" style={{ background: s.color }} />
              {s.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function VPPortfolioPage() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        setError(null);

        const wid = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : ''
        ).get('workspace_id');

        if (!wid) { setError('No workspace selected'); return; }
        setWorkspaceId(wid);

        const response = await authedFetch(`/api/vp/portfolio?workspace_id=${wid}`);
        if (!response.ok) {
          const d = await response.json();
          throw new Error(d.error || 'Failed to fetch portfolio');
        }
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-24 bg-gray-100 rounded" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">Error loading portfolio</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  const { kpis, teams, warnings, trend, outcomes } = data;

  const kpiTiles = [
    {
      label: 'Org quality score',
      value: kpis.org_quality !== null ? String(kpis.org_quality) : '—',
      sub:
        kpis.org_quality_delta === null
          ? 'vs 90-day avg'
          : `${kpis.org_quality_delta >= 0 ? '▲' : '▼'} ${Math.abs(kpis.org_quality_delta)} · vs 90d`,
      subColor:
        kpis.org_quality_delta === null
          ? 'var(--ink-3)'
          : kpis.org_quality_delta >= 0
            ? 'var(--good)'
            : 'var(--bad)',
    },
    {
      label: 'Bug-risk (org avg)',
      value: kpis.bug_risk !== null ? String(kpis.bug_risk) : '—',
      sub: 'lower is better',
      subColor: 'var(--ink-3)',
    },
    {
      label: 'Coaching coverage',
      value: kpis.coaching_coverage !== null ? `${kpis.coaching_coverage}%` : '—',
      sub: 'of merged PRs (90d)',
      subColor: 'var(--ink-3)',
    },
    {
      label: 'Active engineers',
      value: String(kpis.active_engineers),
      sub: `of ${kpis.total_engineers} across ${kpis.total_teams} team${kpis.total_teams !== 1 ? 's' : ''}`,
      subColor: 'var(--ink-3)',
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
          Engineering portfolio
        </h1>
        <p style={{ color: 'var(--ink-2)' }}>
          {kpis.total_teams} team{kpis.total_teams !== 1 ? 's' : ''} ·{' '}
          {kpis.total_engineers} engineer{kpis.total_engineers !== 1 ? 's' : ''} · org-wide
          quality &amp; growth · last 90 days
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiTiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[14px] p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
          >
            <div className="text-[12px] mb-2" style={{ color: 'var(--ink-2)' }}>{t.label}</div>
            <div className="text-3xl font-bold leading-none" style={{ color: 'var(--ink)' }}>{t.value}</div>
            <div className="text-[12px] mt-2" style={{ color: t.subColor }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Teams + Early warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8 items-start">
        {/* Teams table */}
        <div
          className="rounded-[14px] p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          <SectionHeader>Teams — quality vs. momentum</SectionHeader>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {['Team', 'Quality', 'Bug-risk', 'Momentum', 'Coverage'].map((h) => (
                    <th
                      key={h}
                      className="text-[11.5px] font-semibold uppercase pb-2 pr-3"
                      style={{ color: 'var(--ink-3)', letterSpacing: '0.5px', borderBottom: '1px solid var(--line)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const m = MOMENTUM[t.momentum];
                  return (
                    <tr
                      key={t.workspace_id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => router.push(`/manager/team?workspace_id=${t.workspace_id}`)}
                    >
                      <td className="py-3 pr-3 text-[14px] font-semibold" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>
                        {t.name}
                        <span className="block text-[11px] font-normal" style={{ color: 'var(--ink-3)' }}>
                          {t.developer_count} dev{t.developer_count !== 1 ? 's' : ''} · {t.pr_count_30d} PR{t.pr_count_30d !== 1 ? 's' : ''} 30d
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[14px] font-semibold" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>
                        {t.quality ?? '—'}
                      </td>
                      <td className="py-3 pr-3 text-[14px]" style={{ color: 'var(--ink-2)', borderBottom: '1px solid var(--line)' }}>
                        {t.bug_risk ?? '—'}
                      </td>
                      <td className="py-3 pr-3 text-[13px]" style={{ color: m.color, borderBottom: '1px solid var(--line)' }}>
                        {m.arrow} {m.label}
                      </td>
                      <td className="py-3 text-[14px]" style={{ color: 'var(--ink-2)', borderBottom: '1px solid var(--line)' }}>
                        {t.coverage !== null ? `${t.coverage}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] mt-3" style={{ color: 'var(--ink-3)' }}>
            Click a team to drop into its manager view.
          </p>
        </div>

        {/* Early warnings */}
        <div
          className="rounded-[14px] p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          <SectionHeader>Early warnings across the org</SectionHeader>
          <div className="space-y-3 mt-4">
            {warnings.length === 0 && (
              <p className="text-[13px] py-4" style={{ color: 'var(--ink-3)' }}>
                No warnings — all teams look healthy this period.
              </p>
            )}
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-[10px] p-3 cursor-pointer hover:shadow-sm transition-shadow"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
                onClick={() => router.push(`/manager/team?workspace_id=${w.workspace_id}`)}
              >
                <span className="text-lg flex-shrink-0">{w.icon}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {w.title}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
                    {w.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Org trend */}
      <div
        className="rounded-[14px] p-6 mb-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
      >
        <SectionHeader>Org quality trend · 15-day periods over the last 90 days</SectionHeader>
        <div className="mt-4">
          <TrendChart trend={trend} />
        </div>
      </div>

      {/* Outcome tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="rounded-[14px] p-5 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          <div className="text-[12px] mb-2" style={{ color: 'var(--ink-2)' }}>Devs improving or steady</div>
          <div className="text-3xl font-bold" style={{ color: 'var(--ink)' }}>
            {outcomes.devs_improving_pct !== null ? `${outcomes.devs_improving_pct}%` : '—'}
          </div>
          <div className="text-[12px] mt-2" style={{ color: outcomes.devs_improving_pct !== null && outcomes.devs_improving_pct >= 70 ? 'var(--good)' : 'var(--ink-3)' }}>
            target &gt;70{outcomes.devs_improving_pct !== null && outcomes.devs_improving_pct >= 70 ? ' ✓' : ''}
          </div>
        </div>
        <div
          className="rounded-[14px] p-5 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          <div className="text-[12px] mb-2" style={{ color: 'var(--ink-2)' }}>Coaching items delivered</div>
          <div className="text-3xl font-bold" style={{ color: 'var(--ink)' }}>{outcomes.coaching_items_90d}</div>
          <div className="text-[12px] mt-2" style={{ color: 'var(--ink-3)' }}>last 90 days</div>
        </div>
        <div
          className="rounded-[14px] p-5 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        >
          <div className="text-[12px] mb-2" style={{ color: 'var(--ink-2)' }}>PRs scored</div>
          <div className="text-3xl font-bold" style={{ color: 'var(--ink)' }}>{outcomes.prs_scored_90d}</div>
          <div className="text-[12px] mt-2" style={{ color: 'var(--ink-3)' }}>last 90 days</div>
        </div>
      </div>
    </div>
  );
}
