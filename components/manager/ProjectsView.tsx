'use client';

/**
 * Projects view for the manager page — quality rolled up per connected
 * repo, matching the DrCodium-1.html prototype's Projects tab: project
 * cards (initials badge, momentum tag, quality + open issues, progress
 * bar) and a release-over-release quality chart for the selected
 * project (quality vs bug-risk lines).
 */

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface TrendPoint {
  label: string;
  quality: number | null;
  bug_risk: number | null;
}

interface Project {
  repo_id: string;
  name: string;
  full_name: string;
  quality: number | null;
  open_issues: number;
  momentum: 'improving' | 'steady' | 'watch' | 'no_data';
  pr_count_30d: number;
  trend: TrendPoint[];
}

interface ProjectsViewProps {
  workspaceId: string;
}

const MOMENTUM: Record<Project['momentum'], { label: string; arrow: string; color: string }> = {
  improving: { label: 'improving', arrow: '▲', color: 'var(--good)' },
  steady:    { label: 'steady',    arrow: '—', color: 'var(--ink-2)' },
  watch:     { label: 'watch',     arrow: '▼', color: 'var(--bad)' },
  no_data:   { label: 'no data',   arrow: '·', color: 'var(--ink-3)' },
};

// Accent per card position, cycling sage → clay → teal like the prototype
const ACCENTS = ['var(--sage)', 'var(--clay)', 'var(--teal)', 'var(--amber)', 'var(--rose)'];

function initialsOf(name: string): string {
  const parts = name.replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Release-over-release chart: quality + bug-risk lines */
function ReleaseChart({ trend }: { trend: TrendPoint[] }) {
  const W = 900;
  const H = 260;
  const PAD = { top: 20, right: 24, bottom: 36, left: 24 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (trend.length > 1 ? (i / (trend.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const lineFor = (key: 'quality' | 'bug_risk') => {
    const pts = trend
      .map((p, i) => ({ v: p[key], i }))
      .filter((p): p is { v: number; i: number } => p.v !== null);
    if (pts.length < 2) return null;
    return pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');
  };

  const series: { key: 'quality' | 'bug_risk'; label: string; color: string }[] = [
    { key: 'quality', label: 'quality', color: 'var(--sage)' },
    { key: 'bug_risk', label: 'bug-risk (lower is better)', color: 'var(--clay)' },
  ];

  const hasAnyLine = series.some((s) => lineFor(s.key) !== null);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
        {[25, 50, 75].map((v) => (
          <line
            key={v}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--line-2)"
          strokeWidth="1"
        />
        {series.map((s) => {
          const d = lineFor(s.key);
          if (!d) return null;
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
              {trend.map((p, i) =>
                p[s.key] !== null ? (
                  <circle key={i} cx={x(i)} cy={y(p[s.key]!)} r="4" fill={s.color} />
                ) : null
              )}
            </g>
          );
        })}
        {trend.map((p, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            fontSize="13"
            fill="var(--ink-3)"
          >
            {p.label}
          </text>
        ))}
        {!hasAnyLine && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fill="var(--ink-3)">
            Not enough scored PRs yet to draw a release trend
          </text>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-4 mt-2">
        {series.map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--ink-2)' }}
          >
            <i
              className="inline-block w-2.5 h-2.5 rounded-full not-italic"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const MAX_PROJECTS = 5;

export default function ProjectsView({ workspaceId }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newRepo, setNewRepo] = useState('');
  const [addStatus, setAddStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await authedFetch(
          `/api/manager/projects?workspace_id=${workspaceId}`
        );
        if (!response.ok) {
          const d = await response.json();
          throw new Error(d.error || 'Failed to fetch projects');
        }
        const data = await response.json();
        if (cancelled) return;
        setProjects(data.projects);
        setSelectedId((prev) =>
          prev && data.projects.some((p: Project) => p.repo_id === prev)
            ? prev
            : data.projects[0]?.repo_id ?? null
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, refreshKey]);

  const handleAdd = async () => {
    if (!newRepo.trim()) return;
    setAdding(true);
    setAddStatus(null);
    try {
      const response = await authedFetch(`/api/manager/repos?workspace_id=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: newRepo.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to connect project');
      setAddStatus({
        text: `${data.project.full_name} connected — run a scan to pull its PRs`,
        isError: false,
      });
      setNewRepo('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setAddStatus({
        text: err instanceof Error ? err.message : 'Failed to connect project',
        isError: true,
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDisconnect = async (repoId: string, name: string) => {
    if (!confirm(`Disconnect ${name}? Its PR history and scores are kept.`)) return;
    try {
      const response = await authedFetch(
        `/api/manager/repos?workspace_id=${workspaceId}&repo_id=${repoId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to disconnect');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setAddStatus({
        text: err instanceof Error ? err.message : 'Failed to disconnect',
        isError: true,
      });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-100 rounded" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">Error loading projects</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const selected = projects.find((p) => p.repo_id === selectedId) || projects[0];

  const addCard = projects.length < MAX_PROJECTS && (
    <div
      className="rounded-[14px] p-5 flex flex-col justify-center"
      style={{ background: 'var(--surface-2)', border: '1px dashed var(--line-2)' }}
    >
      <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
        {projects.length === 0 ? 'Connect a project' : 'Add a project (optional)'}
      </div>
      <div className="text-[12px] mb-3" style={{ color: 'var(--ink-3)' }}>
        {projects.length} of {MAX_PROJECTS} connected · scores roll up across all projects
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newRepo}
          onChange={(e) => setNewRepo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !adding && handleAdd()}
          placeholder="owner/repo"
          className="flex-1 min-w-0 text-[13px] px-3 py-2 rounded-[8px] outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newRepo.trim()}
          className="text-[13px] font-medium px-4 py-2 rounded-[8px] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          style={{ background: 'var(--sage)', color: '#fff' }}
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      {addStatus && (
        <p className="text-[12px] mt-2" style={{ color: addStatus.isError ? 'var(--bad)' : 'var(--good)' }}>
          {addStatus.text}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p, idx) => {
          const m = MOMENTUM[p.momentum];
          const accent = ACCENTS[idx % ACCENTS.length];
          const isSelected = p.repo_id === selected.repo_id;
          return (
            <div
              key={p.repo_id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(p.repo_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedId(p.repo_id);
              }}
              className="rounded-[14px] p-5 cursor-pointer transition-shadow hover:shadow-md"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isSelected ? 'var(--line-2)' : 'var(--line)'}`,
                boxShadow: isSelected ? 'var(--shadow)' : 'none',
              }}
            >
              {/* Header: initials + name + momentum */}
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="text-[13px] font-bold flex-shrink-0"
                  style={{ color: accent }}
                >
                  {initialsOf(p.name)}
                </span>
                <span
                  className="text-[16px] font-bold flex-1 min-w-0 truncate"
                  style={{ color: 'var(--ink)' }}
                  title={p.full_name}
                >
                  {p.name}
                </span>
                <span className="text-[12px] font-medium flex-shrink-0" style={{ color: m.color }}>
                  {m.arrow} {m.label}
                </span>
                {idx > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnect(p.repo_id, p.full_name);
                    }}
                    className="flex-shrink-0 border-0 bg-transparent cursor-pointer text-[14px] leading-none px-1"
                    style={{ color: 'var(--ink-3)' }}
                    title={`Disconnect ${p.full_name}`}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Quality + open issues */}
              <div className="flex items-end gap-8 mb-4">
                <div>
                  <div className="text-[12px] mb-1" style={{ color: 'var(--ink-2)' }}>
                    Quality
                  </div>
                  <div className="text-3xl font-bold leading-none" style={{ color: 'var(--ink)' }}>
                    {p.quality ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] mb-1" style={{ color: 'var(--ink-2)' }}>
                    Open issues
                  </div>
                  <div className="text-3xl font-bold leading-none" style={{ color: 'var(--ink)' }}>
                    {p.open_issues}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="h-[7px] rounded-full overflow-hidden"
                style={{ background: 'var(--line)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${p.quality ?? 0}%`,
                    background: accent,
                  }}
                />
              </div>
            </div>
          );
        })}
        {addCard}
      </div>

      {/* Release-over-release chart for the selected project */}
      {selected && (
        <div
          className="rounded-[14px] p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <h2
            className="text-[11px] font-semibold uppercase"
            style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}
          >
            Release-over-release quality · {selected.name}
          </h2>
          <div className="mt-4">
            <ReleaseChart trend={selected.trend} />
          </div>
        </div>
      )}
    </div>
  );
}
