'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import DeveloperCoachingDashboard from '@/components/dashboard/DeveloperCoachingDashboard';
import PRDetailsAccordion from '@/components/manager/PRDetailsAccordion';
import { deriveCoachingItems } from '@/lib/coaching-derive';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface FeedbackItem {
  type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
  dimension?: string;
  title?: string;
  description?: string;
  file_path?: string;
  line_number?: number;
}

interface ScoreRow {
  code_quality: number;
  bug_risk: number;
  architecture: number;
  test_coverage: number;
  overall_assessment?: string;
  feedback?: FeedbackItem[];
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
  feedback: Array<{
    type: 'GOOD' | 'IMPROVE' | 'FIX' | 'SUGGEST';
    dimension: string | null;
    title: string | null;
    description: string | null;
    file_path: string | null;
    line_number: number | null;
  }>;
}

interface PrRow {
  id: string;
  number: number;
  title: string;
  merged_at: string;
  repo_id?: string | null;
  score?: ScoreRow;
}

export default function DashboardPage() {
  const [data, setData] = useState<React.ComponentProps<typeof DeveloperCoachingDashboard> | null>(null);
  const [reviewDetails, setReviewDetails] = useState<ReviewDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { setError('Not authenticated'); setLoading(false); return; }

      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, display_name')
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) { setError('No workspace membership'); setLoading(false); return; }

      const firstName = (membership.display_name || user.email || 'there').split(/[\s@]/)[0];

      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: prList }, { data: repoList }] = await Promise.all([
        supabase
          .from('pull_requests')
          .select(`id, number, title, merged_at, repo_id,
            pr_scores(code_quality, bug_risk, architecture, test_coverage, overall_assessment, feedback)`)
          .eq('workspace_id', membership.workspace_id)
          .eq('developer_id', user.id)
          .order('merged_at', { ascending: false })
          .limit(30),
        supabase
          .from('repos')
          .select('id, name')
          .eq('workspace_id', membership.workspace_id)
          .eq('is_active', true),
      ]);

      const repoNameMap: Record<string, string> = {};
      (repoList || []).forEach((repo: { id: string; name: string }) => {
        repoNameMap[repo.id] = repo.name;
      });

      const prs: PrRow[] = (prList || []).map((pr: {
        id: string; number: number; title: string; merged_at: string; repo_id?: string | null;
        pr_scores?: ScoreRow[];
      }) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        repo_id: pr.repo_id,
        score: pr.pr_scores?.[0],
      }));

      const scored = prs.filter((pr): pr is PrRow & { score: ScoreRow } => !!pr.score);
      const scored30 = scored.filter((pr) => pr.merged_at >= thirtyDaysAgo);

      const avg = (key: keyof Pick<ScoreRow, 'code_quality' | 'bug_risk' | 'architecture' | 'test_coverage'>) =>
        scored30.length
          ? scored30.reduce((s, pr) => s + (pr.score[key] || 0), 0) / scored30.length
          : null;

      const dimensions = {
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
                (dimensions.test_coverage ?? 0)) / 4
            )
          : 0;

      const winsLogged = scored30.reduce(
        (n, pr) => n + (pr.score.feedback || []).filter((f: FeedbackItem) => f.type === 'GOOD').length,
        0
      );

      const overallOf = (pr: PrRow & { score: ScoreRow }) =>
        (pr.score.code_quality + (100 - pr.score.bug_risk) + pr.score.architecture + pr.score.test_coverage) / 4;

      let momentum = { label: 'building', arrow: '·', color: 'var(--ink-3)' };
      if (scored.length >= 4) {
        const mid = Math.floor(scored.length / 2);
        const avgOf = (arr: typeof scored) => arr.reduce((s, pr) => s + overallOf(pr), 0) / arr.length;
        const diff = avgOf(scored.slice(0, mid)) - avgOf(scored.slice(mid));
        if (diff > 3) momentum = { label: 'improving', arrow: '▲', color: 'var(--good)' };
        else if (diff < -3) momentum = { label: 'watch', arrow: '▼', color: 'var(--bad)' };
        else momentum = { label: 'steady', arrow: '—', color: 'var(--ink-2)' };
      }

      const streak = [false, false, false, false, false, false, false];
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
      prs.forEach((pr) => {
        if (!pr.merged_at) return;
        const d = new Date(pr.merged_at);
        if (d >= startOfWeek) streak[(d.getDay() + 6) % 7] = true;
      });

      const quests = scored
        .flatMap((pr) =>
          (pr.score.feedback || [])
            .filter((f: FeedbackItem) => f.type !== 'GOOD')
            .map((f: FeedbackItem, i: number) => ({
              id: `${pr.id}-${i}`,
              type: f.type,
              title: f.title || '',
              description: f.description || '',
              pr_number: pr.number,
            }))
        )
        .slice(0, 3);

      const coachingItems = deriveCoachingItems(
        scored.map((pr) => ({
          pr_number: pr.number,
          pr_title: pr.title,
          overall_assessment: pr.score.overall_assessment,
          feedback: pr.score.feedback || [],
        }))
      );

      const overallOfScore = (s: ScoreRow) =>
        Math.round((s.code_quality + (100 - s.bug_risk) + s.architecture + s.test_coverage) / 4);

      const reviews: ReviewDetail[] = scored.slice(0, 20).map((pr) => ({
        pr_number: pr.number,
        pr_title: pr.title,
        merged_at: pr.merged_at,
        overall_score: overallOfScore(pr.score),
        repo_name: pr.repo_id ? (repoNameMap[pr.repo_id] ?? null) : null,
        dimensions: {
          code_quality: pr.score.code_quality,
          bug_risk: pr.score.bug_risk,
          architecture: pr.score.architecture,
          test_coverage: pr.score.test_coverage,
        },
        overall_assessment: pr.score.overall_assessment || null,
        feedback: (pr.score.feedback || []).map((f) => ({
          type: f.type,
          dimension: f.dimension || null,
          title: f.title || null,
          description: f.description || null,
          file_path: f.file_path || null,
          line_number: f.line_number ?? null,
        })),
      }));

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
        coachingItems,
      });
      setReviewDetails(reviews);
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard');
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <p style={{ color: 'var(--ink-3)' }}>Loading your growth data…</p>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center h-96">
      <p style={{ color: 'var(--bad)' }}>{error || 'No data'}</p>
    </div>
  );

  return (
    <>
      <DeveloperCoachingDashboard {...data} />
      <div className="mx-auto max-w-2xl px-6 pb-8">
        <PRDetailsAccordion reviews={reviewDetails} />
      </div>
    </>
  );
}
