# Growth Path — Phase 5.2

Complete guide to tracking performance trends over time (30/60/90-day windows).

---

## Overview

**Location:** `/app/dashboard/growth-path`

**Purpose:** Show developer's performance trajectory, comparing how they're doing now vs. the recent past.

**Key Visualizations:**
- **Wave:** Overall score trend (smoothed bezier curve)
- **Trend Comparison:** Each dimension across 30/60/90 days with ↑↓→ indicators
- **Performance History:** Summary cards for each time window (reverse-chronological)

---

## Wave Visualization

### What It Shows

Smooth performance curve showing overall score across three time windows (90 days → 60 days → 30 days).

**Overall Score Calculation:**
```
score = (code_quality + (100 - bug_risk) + architecture + test_coverage) / 4
```

### Visual Design

**SVG Chart (400×200 canvas):**
- Y-axis: 0-100 (score range)
- X-axis: 90-day, 60-day, 30-day (time progression)
- Grid lines: Subtle at 50 and 100
- Bezier curve: Smooth connection through 3 points

**Color Coding (based on 30d vs 90d trend):**
- Green (#10b981): Improving (30d score > 90d + 5 points)
- Red (#ef4444): Declining (30d score < 90d - 5 points)
- Gray (#6b7280): Stable (within ±5 points)

**Data Points:**
- Circle markers at each (90d, 60d, 30d)
- Latest point (30d) colored by trend
- Earlier points (90d, 60d) shown in gray
- Score label above each point

### Trend Summary

Below the wave:
```
↑ Improving (+10.5 points)
↓ Declining (-8.2 points)
→ Stable (±2.1 points)
```

Shows overall direction and magnitude of change from 90-day to current.

### Example

```
Developer Alice:
  90-day: 70
  60-day: 75
  30-day: 82

Result:
  Wave curves up (green)
  Label: "↑ Improving (+12 points)"
```

---

## Trend Comparison

### What It Shows

Each dimension (code_quality, bug_risk, architecture, test_coverage) across all 3 windows with trend indicators.

### Layout per Dimension Card

```
[Icon] Dimension Name                [Trend Arrow ↑]

| 90-day    | 60-day    | 30-day    |
|-----------|-----------|-----------|
| Score     | Score     | Score     |
| N PRs     | N PRs     | N PRs     |

✓ Trending up — keep up the good work!
```

### Trend Calculation

Per dimension:
```typescript
trend = score_30d - score_90d

if (trend > 5) → ↑ Improving
if (trend < -5) → ↓ Declining
if (-5 <= trend <= 5) → → Stable
```

**Exception:** `bug_risk` is inverted (lower is better)
```typescript
adj_30d = 100 - bug_risk_30d
adj_90d = 100 - bug_risk_90d
trend = adj_30d - adj_90d
```

### Color Coding

- **Trend Arrow:** Green ↑, Red ↓, Gray →
- **30-day Column:** Light blue background (current focus)
- **90/60-day Columns:** Gray background (historical)

### Interpretation Messages

| Trend | Message |
|-------|---------|
| ↑ | "✓ Trending up — keep up the good work!" |
| ↓ | "⚠ Trending down — focus on this area" |
| → | "— Stable performance" |

### Dimensions Shown

1. **Code Quality (✨)**
   - Direct score (0-100)
   - Higher is better

2. **Bug Risk (🐛)**
   - Inverted: display as (100 - bug_risk)
   - Higher display = lower actual risk (better)

3. **Architecture (🏗️)**
   - Direct score (0-100)
   - Higher is better

4. **Test Coverage (✅)**
   - Direct score (0-100)
   - Higher is better

---

## Performance History

### What It Shows

Summary cards for each time window, reverse-chronological order (newest first).

### Card Order

1. **30-day (Latest/Current)** — Top, blue background
2. **60-day** — Middle, white background
3. **90-day (Oldest)** — Bottom, white background

**Timeline line** connects cards vertically.

### Card Layout

```
[Emoji] Label                        [Score Badge]
                                     (e.g., 82)

| Quality | Risk | Architecture | Tests |
|---------|------|---------------|-------|
|   85    |  80  |      82      |  88   |

6 PRs scored | ✓ Confident
```

### Card Header

- **Emoji:** 📊 (30d), 📈 (60d), 📉 (90d)
- **Label:** "Last 30 Days", "Last 60 Days", "Last 90 Days"
- **Current Badge:** Only on 30-day card, says "Current"
- **Score Badge:** Top right, color-coded (green/blue/amber/red)

### Dimension Breakdown

Each card shows 4 columns:
- **Quality:** Direct avg_code_quality
- **Risk:** (100 - avg_bug_risk) — inverted display
- **Architecture:** Direct avg_architecture
- **Tests:** Direct avg_test_coverage

### Confidence Footer

```
N PRs scored | ✓ Confident
(or)
N PRs scored | ⚠ Low confidence
```

- **Confident:** score_count >= 3
- **Low confidence:** score_count < 3

### Example

```
30-day card:
  Score: 82 (blue badge)
  Quality: 85 | Risk: 80 | Arch: 82 | Tests: 88
  "7 PRs scored | ✓ Confident"

60-day card:
  Score: 78
  Quality: 82 | Risk: 75 | Arch: 80 | Tests: 85
  "12 PRs scored | ✓ Confident"
```

---

## Data Fetching

### Query Path

```sql
SELECT * FROM pr_aggregates
WHERE workspace_id = ?
  AND developer_id = current_user.id
```

Returns all three windows:
- `avg_code_quality_30d`, `avg_bug_risk_30d`, `avg_architecture_30d`, `avg_test_coverage_30d`
- `avg_code_quality_60d`, `avg_bug_risk_60d`, `avg_architecture_60d`, `avg_test_coverage_60d`
- `avg_code_quality_90d`, `avg_bug_risk_90d`, `avg_architecture_90d`, `avg_test_coverage_90d`
- `score_count_30d`, `score_count_60d`, `score_count_90d`
- `confidence_badge_30d`, `confidence_badge_60d`, `confidence_badge_90d`

### Error Handling

- **Not authenticated:** "Not authenticated"
- **No workspace:** "No workspace membership"
- **No aggregates:** "No performance data yet"
- **Fetch error:** "Failed to load growth data"

---

## Responsive Design

### Desktop (lg: ≥1024px)

- Wave chart: Full width
- Trend Comparison: Full width with 4 dimension cards per row
- Performance History: Full width cards

### Tablet (md: ≥768px)

- Trend Comparison dimensions: 2 per row
- Cards stack normally

### Mobile (sm: <768px)

- All elements stack vertically
- Wave chart: Responsive SVG viewBox
- Dimension cards: 1 per row
- Performance cards: Single column

---

## Performance Considerations

### Data Fetching

- Single query to `pr_aggregates` (all windows in one row)
- No refetching (static historical data)
- Filter by current_user for RLS compliance

### Rendering

- Wave: SVG path + circles (lightweight)
- Dimension cards: Grid layout (CSS only)
- Performance cards: Semantic HTML + CSS grid
- No JavaScript animation on scroll

### Bundle

- Components: Pure React/CSS, no D3 or charting library
- SVG: Inline, no external images
- CSS: Tailwind classes only

---

## Accessibility

### Color Contrast

- Trend arrows: WCAG AA compliant (4.5:1)
- Text on badges: Sufficient contrast
- Grid lines: Low contrast but not text

### Keyboard Navigation

- All cards: Focusable regions
- Links (if any): Proper focus indicators
- Semantic HTML: `<h1>`, `<h2>`, `<section>` tags

### Screen Reader

- SVG wave: Descriptive title or aria-label
- Trend arrows: Unicode characters (↑/↓/→) read naturally
- Cards: Semantic structure announced

---

## Interpretation Guide for Developers

### Wave Meaning

- **Wave going up (↑):** You're improving — great momentum!
- **Wave going down (↓):** Performance declining — investigate why
- **Wave flat (→):** Stable — consistent performance

### Dimension Trends

- **Green ↑ on dimension:** Focus area improving, celebrate wins
- **Red ↓ on dimension:** Needs attention, review recent feedback
- **Gray → on dimension:** Consistent, maintain current practices

### Confidence Interpretation

- **✓ Confident (3+ PRs):** Trend is statistically reliable
- **⚠ Low confidence (<3 PRs):** Not enough data yet, keep scoring

### Action Prompts

1. **If overall improving (↑):** "Keep up the momentum! Focus on red ↓ dimensions."
2. **If overall stable (→):** "Consistent work. Pick a red ↓ dimension and improve it."
3. **If overall declining (↓):** "Let's reverse this trend. Review the top red ↓ areas."

---

## File Structure

```
app/dashboard/growth-path/
  page.tsx                      # Main growth path page

components/dashboard/
  WaveVisualization.tsx         # Trend curve visualization
  TrendComparison.tsx           # Per-dimension trends
  PerformanceHistory.tsx        # Time window summary cards

tests/
  growth-path.test.ts           # 31 test placeholders
```

---

## Component API

### WaveVisualization

```typescript
<WaveVisualization
  data_30d={aggregateWindow}
  data_60d={aggregateWindow}
  data_90d={aggregateWindow}
/>

Props:
  data_30d, data_60d, data_90d: AggregateWindow
    - avg_code_quality, avg_bug_risk, avg_architecture, avg_test_coverage
    - score_count, confidence_badge
```

### TrendComparison

```typescript
<TrendComparison
  data_30d={aggregateWindow}
  data_60d={aggregateWindow}
  data_90d={aggregateWindow}
/>

Props: Same as WaveVisualization
```

### PerformanceHistory

```typescript
<PerformanceHistory
  data_30d={aggregateWindow}
  data_60d={aggregateWindow}
  data_90d={aggregateWindow}
/>

Props: Same as WaveVisualization
```

---

## Future Enhancements

### Phase 5.3+

- **Coaching Details:** Click dimension to see feedback for that area
- **Comparison Mode:** Compare yourself to team average
- **Export Report:** Download growth summary as PDF
- **Sharing:** Share growth update with manager
- **Predictions:** "If you keep improving at this rate, you'll hit 90 by..."
- **Milestones:** Celebrate reaching 85, 90, 95+ overall scores
- **Coaching Recommendations:** Auto-generated quests based on trends

---

## Testing

### Test Coverage

- Growth path page rendering (TC-GROWTH-001 through TC-GROWTH-031)
- Wave visualization (data points, colors, labels)
- Trend comparison (arrows, interpretations)
- Performance history (cards, timeline, confidence)
- Data fetching and error handling
- Responsive layouts
- Accessibility

---

## Known Limitations

- **Real-time:** Page doesn't auto-refresh (refresh to see latest aggregates)
- **Historical Data:** Only shows 30/60/90 windows (not granular day-by-day)
- **Predictions:** No forecasting or "on pace to reach X" yet
- **Comparison:** No peer benchmarking (only self-comparison)
- **Mobile:** Wave chart may be small on very narrow screens

---

## Next Steps

- Phase 5.3: Coaching Card Details (click to drill into feedback)
- Phase 5.4: Feedback Thumbs (helpful voting on coaching items)
- Phase 6: Manager Experience (team garden, peer comparison)
