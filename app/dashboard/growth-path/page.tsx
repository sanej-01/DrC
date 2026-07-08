'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import TrendComparison from '@/components/dashboard/TrendComparison';
import WaveVisualization from '@/components/dashboard/WaveVisualization';
import PerformanceHistory from '@/components/dashboard/PerformanceHistory';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface AggregateWindow {
  days: 30 | 60 | 90;
  avg_code_quality: number | null;
  avg_bug_risk: number | null;
  avg_architecture: number | null;
  avg_test_coverage: number | null;
  score_count: number;
  confidence_badge: 'LOW_CONFIDENCE' | 'CONFIDENT';
}

interface GrowthPathData {
  window_30d: AggregateWindow;
  window_60d: AggregateWindow;
  window_90d: AggregateWindow;
}

export default function GrowthPathPage() {
  const [data, setData] = useState<GrowthPathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGrowthPath();
  }, []);

  async function loadGrowthPath() {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Get user's workspace membership
      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        setError('No workspace membership');
        setLoading(false);
        return;
      }

      // Get aggregates for all 3 windows
      const { data: aggs, error: aggError } = await supabase
        .from('pr_aggregates')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .eq('developer_id', user.id)
        .single();

      if (aggError) {
        setError('Failed to load growth data');
        setLoading(false);
        return;
      }

      if (!aggs) {
        setError('No performance data yet');
        setLoading(false);
        return;
      }

      const pathData: GrowthPathData = {
        window_30d: {
          days: 30,
          avg_code_quality: aggs.avg_code_quality_30d,
          avg_bug_risk: aggs.avg_bug_risk_30d,
          avg_architecture: aggs.avg_architecture_30d,
          avg_test_coverage: aggs.avg_test_coverage_30d,
          score_count: aggs.score_count_30d,
          confidence_badge: aggs.confidence_badge_30d,
        },
        window_60d: {
          days: 60,
          avg_code_quality: aggs.avg_code_quality_60d,
          avg_bug_risk: aggs.avg_bug_risk_60d,
          avg_architecture: aggs.avg_architecture_60d,
          avg_test_coverage: aggs.avg_test_coverage_60d,
          score_count: aggs.score_count_60d,
          confidence_badge: aggs.confidence_badge_60d,
        },
        window_90d: {
          days: 90,
          avg_code_quality: aggs.avg_code_quality_90d,
          avg_bug_risk: aggs.avg_bug_risk_90d,
          avg_architecture: aggs.avg_architecture_90d,
          avg_test_coverage: aggs.avg_test_coverage_90d,
          score_count: aggs.score_count_90d,
          confidence_badge: aggs.confidence_badge_90d,
        },
      };

      setData(pathData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading growth path:', err);
      setError('Failed to load growth data');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading your growth path...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Your Growth Path</h1>
        <p className="text-gray-600">
          Track your performance over time across 30, 60, and 90-day windows
        </p>
      </div>

      {/* Wave Visualization */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Performance Wave</h2>
        <WaveVisualization
          data_30d={data.window_30d}
          data_60d={data.window_60d}
          data_90d={data.window_90d}
        />
        <p className="text-xs text-gray-500 text-center mt-4">
          Overall trend showing how your performance has evolved over time
        </p>
      </div>

      {/* Trend Comparison */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Dimension Trends</h2>
        <TrendComparison
          data_30d={data.window_30d}
          data_60d={data.window_60d}
          data_90d={data.window_90d}
        />
        <p className="text-xs text-gray-500 text-center mt-4">
          ↑ Improving | ↓ Declining | → Stable
        </p>
      </div>

      {/* Performance History */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Performance by Window</h2>
        <PerformanceHistory
          data_30d={data.window_30d}
          data_60d={data.window_60d}
          data_90d={data.window_90d}
        />
      </div>

      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Insights</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • Comparing 30-day to 90-day shows if you're improving or regressing
          </li>
          <li>
            • Focus on dimensions where you see red ↓ trends
          </li>
          <li>
            • Green ↑ trends indicate good momentum — keep it up!
          </li>
        </ul>
      </div>
    </div>
  );
}
