/**
 * Shared coaching-item derivation used by both the developer dashboard
 * (client) and the manager individual-stats route (server). Produces at
 * least two coaching suggestions when the feedback allows, preferring
 * bug-risk items and then filling from code quality, architecture, and
 * test coverage so a developer always has more than a single thread to
 * pull on.
 */

export interface CoachingSource {
  pr_number: number;
  pr_title: string;
  overall_assessment?: string | null;
  feedback: Array<{
    type: string;
    dimension?: string | null;
    title?: string | null;
    description?: string | null;
  }>;
}

export interface CoachingItem {
  pr_number: number;
  pr_title: string;
  headline: string;
  tag: string | null;
  body: string;
  dimension: string | null;
}

// Lower number = higher priority. Bug-risk coaching leads, then the
// remaining dimensions in the order the scoring rubric lists them.
const DIM_PRIORITY: Record<string, number> = {
  bug_risk: 0,
  code_quality: 1,
  architecture: 2,
  test_coverage: 3,
};

export function normalizeDimension(dim?: string | null): string | null {
  if (!dim) return null;
  return dim.toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * @param prs   scored PRs, most-recent first
 * @param max   hard cap on returned items (default 3)
 */
export function deriveCoachingItems(
  prs: CoachingSource[],
  max = 3
): CoachingItem[] {
  const candidates: Array<CoachingItem & { _priority: number; _order: number }> = [];
  let order = 0;

  for (const pr of prs) {
    for (const f of pr.feedback || []) {
      if (f.type === "GOOD") continue;
      const title = (f.title || "").trim();
      const description = (f.description || "").trim();
      if (!title && !description) continue;

      const dimKey = normalizeDimension(f.dimension);
      candidates.push({
        pr_number: pr.pr_number,
        pr_title: pr.pr_title,
        headline: title || description.slice(0, 60),
        tag: f.dimension || null,
        body: description || pr.overall_assessment || title,
        dimension: dimKey,
        _priority: dimKey && dimKey in DIM_PRIORITY ? DIM_PRIORITY[dimKey] : 4,
        _order: order++,
      });
    }
  }

  // Dimension priority first, recency (original order) as the tiebreak.
  candidates.sort((a, b) => a._priority - b._priority || a._order - b._order);

  const seen = new Set<string>();
  const out: CoachingItem[] = [];
  for (const c of candidates) {
    const key = c.headline.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      pr_number: c.pr_number,
      pr_title: c.pr_title,
      headline: c.headline,
      tag: c.tag,
      body: c.body,
      dimension: c.dimension,
    });
    if (out.length >= max) break;
  }

  return out;
}
