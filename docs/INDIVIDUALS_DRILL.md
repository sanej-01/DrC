# Individuals Drill — Phase 6.2

Manager drill-down view for individual developer progress and coaching.

---

## Overview

**Purpose:** Managers dive deep into each developer's journey — trends, recent PRs, coaching effectiveness.

**Access:** Managers+ only, via team garden

**Route:** `/app/manager/team/[developerId]?workspace_id=...`

---

## Data Model

### Individual Stats Endpoint

**GET `/api/manager/team/[developerId]/individual-stats?workspace_id=...`**

Returns:
```json
{
  "developer": {
    "id": "uuid",
    "display_name": "Alice",
    "email": "alice@...",
    "github_handle": "alice-dev"
  },
  "trajectory": {
    "score_90d": 82,
    "score_60d": 78,
    "score_30d": 88,
    "pr_count_90d": 15,
    "pr_count_60d": 10,
    "pr_count_30d": 5,
    "trend": "improving"
  },
  "coaching": {
    "total": 12,
    "breakdown": {
      "GOOD": 5,
      "IMPROVE": 4,
      "FIX": 2,
      "SUGGEST": 1
    }
  },
  "recent_prs": [
    {
      "id": "uuid",
      "pr_number": 42,
      "title": "Add user auth",
      "merged_at": "2026-07-08T14:30:00Z",
      "score": 92,
      "dimensions": {
        "quality": 94,
        "bug_risk": 8,
        "architecture": 90,
        "tests": 92
      }
    }
  ],
  "aggregates": {
    "confidence_30d": "CONFIDENT",
    "confidence_60d": "CONFIDENT",
    "confidence_90d": "LOW_CONFIDENCE"
  }
}
```

---

## UI Components

### DeveloperTrajectory

Shows 90-60-30 day score progression with trend analysis.

**Props:**
```typescript
interface TrajectoryData {
  score_90d: number | null;
  score_60d: number | null;
  score_30d: number | null;
  pr_count_90d: number;
  pr_count_60d: number;
  pr_count_30d: number;
  trend: 'improving' | 'declining' | 'stable';
}
```

**Features:**
- Timeline visualization with dots and connecting line
- Score bar for each period
- Trend emoji (📈 📉 ➡️) with interpretation
- Analysis text explaining trend

### PRHeatMap

Recent PRs with color-coded performance and dimension breakdown.

**Props:**
```typescript
interface PRHeatMapProps {
  prs: Array<{
    id: string;
    pr_number: number;
    title: string;
    merged_at: string;
    score: number | null;
    dimensions: { quality, bug_risk, architecture, tests };
  }>;
  limit?: number; // default 15
}
```

**Features:**
- Color gradient based on score (green → red)
- Dimension breakdown for each PR
- Merged date
- Hover effects

**Score Colors:**
- 85+: green
- 70-84: emerald
- 40-69: yellow
- <40: red

### CoachingHistory

Developer's coaching feedback with filters.

**Props:**
```typescript
interface CoachingHistoryProps {
  cards: CoachingCard[];
  breakdown: {
    GOOD: number;
    IMPROVE: number;
    FIX: number;
    SUGGEST: number;
  };
}
```

**Features:**
- Summary badges (GOOD, IMPROVE, FIX, SUGGEST)
- Filter by severity
- Filter by dimension
- Individual coaching item cards

---

## Navigation & Linking

### From Team Garden

Manager views garden → clicks on a developer card → navigates to individual detail page

```typescript
// In team garden card
onClick={() => router.push(`/manager/team/${developer.id}?workspace_id=${workspace_id}`)}
```

### Back Navigation

Detail page has "← Back to team" button to return to garden.

---

## Score Trends

### Trend Calculation

```
trend = if (score_30d - score_90d > 5) → 'improving'
        if (score_30d - score_90d < -5) → 'declining'
        else → 'stable'
```

### Interpretations

| Trend | Meaning | Action |
|-------|---------|--------|
| Improving | Score trending upward | Recognize, leverage for mentoring |
| Declining | Score trending downward | Check for blockers, offer support |
| Stable | Consistent performance | Monitor for changes |

---

## Confidence Badges

Per-period confidence based on PR count in that window:

| Badge | Meaning | PR Count |
|-------|---------|----------|
| ✓ Confident | Sufficient data | ≥ 3 PRs |
| ⚠️ Low Confidence | Insufficient data | < 3 PRs |

Shows on 30-day score (primary indicator for managers).

---

## Coaching Insights

### Breakdown Summary

Shows count per severity:
- GOOD: Positive feedback
- IMPROVE: Suggestions for growth
- FIX: Issues to address
- SUGGEST: Optional enhancements

### Filtering

**By Severity:**
- All / GOOD / IMPROVE / FIX / SUGGEST
- Click to toggle filter
- Shows filtered count

**By Dimension:**
- All / [dynamic dimensions from data]
- Usually: code_quality, bug_risk, architecture, test_coverage
- Combine with severity filter

---

## Quick Stats

### PR Activity

Shows PR count across three windows:
- Last 30 days (current)
- Last 60 days
- Last 90 days

Helps managers see activity patterns (ramping up/down).

### Coaching Summary

Breakdown of coaching types received.
- Ratio indicates balance of feedback
- Mostly "Fix" → need support
- Mostly "GOOD" → strong performer

### Overall Trend

Visual indicator (emoji) + text interpretation.

---

## Performance

**Queries per page load:**
1. Fetch developer metadata: 1 query
2. Fetch aggregates: 1 query
3. Fetch recent PRs (with scores): 1 query
4. Fetch coaching cards: 1 query

**Total:** ~4 queries, < 200ms

**Caching:** None (always fresh data).

---

## Accessibility

- Color not sole indicator (text labels, emoji)
- Tab through filters and PR cards
- Screen reader: semantic HTML, role hints
- Mobile: single column, responsive layout

---

## Security & RLS

**Policies:**
- Manager can only view developers in their workspace
- Manager can only view coaching cards from their workspace PRs
- Developers can't access this page

**Implementation:**
- API uses `withManagerAuth` middleware
- Queries filter by workspace_id
- All user data scoped to workspace

---

## Future Enhancements (Phase 6.3+)

- Manager notes on developer (private)
- Coaching effectiveness trends
- Recommended coaching items
- One-on-one meeting scheduler
- Performance alerts
- Peer comparison (anonymized)

---

## Files

```
app/manager/team/
  [developerId]/
    page.tsx                              # Individual detail page

app/api/manager/team/
  [developerId]/
    individual-stats.ts                   # Individual stats endpoint

components/manager/
  DeveloperTrajectory.tsx                 # 90-day trajectory
  PRHeatMap.tsx                           # Recent PRs with heat
  CoachingHistory.tsx                     # Coaching with filters

docs/
  INDIVIDUALS_DRILL.md                    # This guide
```

---

## Tests

Placeholder tests (TC-DRILL-001 through TC-DRILL-030) in `tests/individuals-drill.test.ts`.

---

## Example User Flow

1. Manager views team garden at `/manager/team`
2. Sees 8 developers, including Alice at "Flourishing" 🌲
3. Clicks Alice's card → navigates to `/manager/team/[alice-id]?workspace_id=...`
4. Sees:
   - Header: Alice, alice@..., @alice-dev, 30-day score: 88 ✓ Confident
   - 90-day trajectory: 82 → 78 → 88 (📈 Improving)
   - Quick stats: 5 PRs (30d), 10 PRs (60d), 15 PRs (90d)
   - Coaching: 5 GOOD, 4 IMPROVE, 2 FIX, 1 SUGGEST
   - Recent PRs: #42 (92 score), #41 (85 score), etc.
   - Coaching history: filterable by severity/dimension
5. Manager filters to "FIX" → sees 2 items to discuss in 1:1
6. Clicks "← Back to team" → returns to garden
