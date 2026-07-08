# Developer Dashboard — Phase 5.1

Complete guide to the developer growth dashboard UI.

---

## Overview

**Location:** `/app/dashboard`

**Purpose:** Developer-focused dashboard showing 30-day performance trends, coaching recommendations, and recent PR history.

**Key Components:**
- Growth Ring: Overall score (0-100) with animated circular progress
- Dimension Tiles: Code quality, bug risk, architecture, test coverage
- Quests: Actionable coaching items (GOOD/IMPROVE/FIX/SUGGEST)
- PR Timeline: Recent scored PRs in reverse-chronological order

---

## Growth Ring

### What It Shows

Animated circular progress ring displaying overall score (0-100).

```
        Score = (code_quality + (100-bug_risk) + architecture + test_coverage) / 4
```

### Visual Design

- **Ring:** Animated SVG circle, strokeWidth=8, radius=45
- **Color:** Performance-based
  - Green (#10b981): Score >= 85
  - Blue (#3b82f6): Score >= 70
  - Amber (#f59e0b): Score >= 55
  - Red (#ef4444): Score < 55

- **Center Label:** Score number (0-100) + "/100"
- **Below Ring:** Performance label (🌟 Excellent / ✨ Great / 💪 Developing / 🎯 Building)

### Animation

- Stroke dash offset animates on load
- Duration: 500ms ease-out
- Ring rotates -90deg so progress starts at top

### Example

```typescript
<GrowthRing score={82} />

// Renders:
// - Ring 82% filled in blue
// - Center shows "82 /100"
// - Label shows "✨ Great"
```

---

## Dimension Tiles

### What They Show

4 tiles, one per scoring dimension. Each tile shows:
- Current score
- Dimension label + description
- Icon + color-coded background
- Confidence indicator (if LOW_CONFIDENCE)

### Dimensions

| Dimension | Emoji | Description | Unit |
|-----------|-------|-------------|------|
| **Code Quality** | ✨ | Style, readability, maintainability | % |
| **Bug Risk** | 🐛 | Likelihood of bugs/crashes | % (inverted) |
| **Architecture** | 🏗️ | Design, extensibility, patterns | % |
| **Test Coverage** | ✅ | Tests written, coverage quality | % |

### Score Coloring

```
Score >= 85: Green (#10b981)
Score >= 70: Blue (#3b82f6)
Score >= 55: Amber (#f59e0b)
Score < 55:  Red (#ef4444)
```

### Bug Risk Inversion

Bug risk is **inverse** (lower is better):
- Displayed as: 100 - bug_risk
- Color based on displayed value
- Example: bug_risk=20 → displays as "80" (green)

### Confidence Badge

If `confidence_badge='LOW_CONFIDENCE'` (< 3 PRs):
- Shows: "Low confidence — score more PRs"
- Appears below score in small text

### No Data Handling

If score is `null`:
- Shows: "No data yet"
- Gray color (#9ca3af)
- No confidence warning

---

## Quests (Coaching)

### What They Are

Actionable coaching items derived from pr_feedback and coaching_cards tables.

### Severity Types

| Type | Color | Badge | Icon | Label |
|------|-------|-------|------|-------|
| **GOOD** | Green | bg-green-100 | ✨ | Well Done |
| **IMPROVE** | Blue | bg-blue-100 | 💡 | Improve |
| **FIX** | Red | bg-red-100 | ⚠️ | Fix |
| **SUGGEST** | Amber | bg-amber-100 | 🎯 | Suggestion |

### Quest Card Layout

```
[icon] Title
       "Improve" (badge)

Description of what to work on

📄 src/api/auth.ts (if file_path set)

[dimension tag]
```

### Empty State

When no coaching cards:
```
🎉 No coaching items right now! Keep up the great work.
```

### Limit

Only **5 most recent** coaching cards displayed.

---

## PR Timeline

### What It Shows

Reverse-chronological list of recent scored PRs.

**Newest at top**, showing:
- PR number and title
- Merge date
- File count, additions, deletions
- All 4 dimension scores

### Timeline Styling

- **Vertical line** on left
- **Colored dot** per PR (green if score>=75, amber if score<75)
- **Line connects** dots between PRs
- **Last PR** has no line below

### PR Card Layout

```
● #456
  "Add login feature"
                            [Score badge: 82]

  📅 Merged Jul 8
  📝 12 files • +245 -87

  [Quality] [Risk] [Arch] [Tests]
   85        80     82     88
```

### Score Display

Each dimension shown as small box:
```
Quality
85
```

Colors match dimension color coding (green/blue/amber/red).

### Empty State

When no scored PRs:
```
No PRs scored yet
```

---

## Data Fetching

### Query Path

1. **Get Current User**
   ```sql
   SELECT * FROM auth.users WHERE id = session.user.id
   ```

2. **Get User's Workspace**
   ```sql
   SELECT workspace_id FROM workspace_members
   WHERE user_id = current_user AND role IN ('developer', 'manager', 'admin')
   LIMIT 1
   ```

3. **Get Aggregates (30-day)**
   ```sql
   SELECT * FROM pr_aggregates
   WHERE workspace_id = ? AND developer_id = ? AND developer_id = current_user
   ```

4. **Get Coaching Cards**
   ```sql
   SELECT * FROM coaching_cards
   WHERE workspace_id = ? AND about_user_id = current_user
   ORDER BY created_at DESC
   LIMIT 5
   ```

5. **Get Recent PRs with Scores**
   ```sql
   SELECT pr.*, ps.* FROM pull_requests pr
   LEFT JOIN pr_scores ps ON pr.id = ps.pr_id
   WHERE pr.workspace_id = ? AND pr.author_id = current_user
   ORDER BY pr.merged_at DESC
   LIMIT 10
   ```

### Error Handling

- **Not authenticated:** "Not authenticated"
- **No workspace:** "No workspace membership"
- **Data fetch error:** "Failed to load dashboard"

---

## Responsive Design

### Layout

```
Desktop (lg: ≥1024px):
  - Growth Ring: centered, full width
  - Dimension Tiles: 4 columns
  - Quests: 1 column
  - PR Timeline: 1 column

Tablet (md: ≥768px):
  - Dimension Tiles: 2 columns

Mobile (sm: <768px):
  - Dimension Tiles: 1 column
```

### Component Sizing

- **Growth Ring:** 200px × 200px SVG
- **Dimension Tiles:** Flexible with grid
- **PR Timeline:** Full width

---

## Accessibility

### Color Contrast

- Text on badges: WCAG AA compliant
- Ring colors: distinct enough for colorblind users
- Icons used alongside colors

### Keyboard Navigation

- Dashboard page: accessible via Tab
- Links: all focusable (#pr-456 links in timeline)
- Focus indicators: standard browser styling

### Screen Reader

- Semantic HTML: `<h1>`, `<h2>`, `<section>`
- ARIA labels on icons
- Alt text on SVG ring (if needed)

---

## Performance Considerations

### Data Fetching

- All queries in `useEffect` with `[]` dependency (run once on mount)
- No refetching (static 30-day data)
- If real-time updates needed: add polling or WebSocket in future

### Rendering

- Components memoized (React.memo) if large lists
- SVG ring animation: GPU-accelerated (transform-origin)
- PR timeline: 10 items max (not too many DOM nodes)

### Bundle

- GrowthRing: SVG only, lightweight
- Dimension Tiles: Pure CSS, no images
- No external libraries (D3, Recharts) — uses SVG directly

---

## Future Enhancements

### Phase 5.2+

- **Growth Path:** Add 60/90-day trends
- **Quests Interactivity:** Click quest to see detailed feedback
- **PR Filtering:** Filter timeline by dimension
- **Trend Arrows:** Show if score improving/declining
- **Notifications:** Highlight new coaching items
- **Sharing:** Share growth summary with manager
- **Dark Mode:** Dark theme styling
- **Export:** Download growth report as PDF

---

## Testing

### Test Coverage

- Dashboard page rendering (TC-DASH-001 through TC-DASH-032)
- Component rendering (Growth Ring, Tiles, Quests, Timeline)
- Data fetching integration
- Error states
- Responsive layouts
- Accessibility

### Example Tests

```typescript
// Render dashboard
it('TC-DASH-001: Render dashboard page', async () => {
  render(<DashboardPage />);
  expect(screen.getByText('Your Growth')).toBeInTheDocument();
});

// Growth ring score
it('TC-DASH-006: Render growth ring with score', async () => {
  render(<GrowthRing score={75} />);
  expect(screen.getByText('75')).toBeInTheDocument();
});

// Dimension tiles
it('TC-DASH-010: Display all 4 dimensions', async () => {
  render(<DimensionTiles stats={{ ... }} />);
  expect(screen.getByText('Code Quality')).toBeInTheDocument();
  expect(screen.getByText('Bug Risk')).toBeInTheDocument();
});
```

---

## File Structure

```
app/dashboard/
  page.tsx                  # Main dashboard page

components/dashboard/
  GrowthRing.tsx            # Animated ring visualization
  DimensionTiles.tsx        # 4 dimension score tiles
  Quests.tsx                # Coaching cards/quests
  PRTimeline.tsx            # Recent PR list

tests/
  dev-dashboard.test.ts     # 32 test placeholders
```

---

## Component API

### GrowthRing

```typescript
<GrowthRing score={82} />

Props:
  score: number (0-100)
```

### DimensionTiles

```typescript
<DimensionTiles 
  stats={{
    code_quality: 85,
    bug_risk: 15,
    architecture: 82,
    test_coverage: 90
  }}
  confidence="CONFIDENT"
/>

Props:
  stats: { code_quality, bug_risk, architecture, test_coverage } (0-100 or null)
  confidence?: "LOW_CONFIDENCE" | "CONFIDENT"
```

### Quests

```typescript
<Quests coaching_cards={[
  {
    id: "uuid",
    dimension: "architecture",
    title: "Refactor auth module",
    description: "Your auth layer needs cleanup",
    severity: "IMPROVE",
    file_path: "src/auth.ts"
  }
]} />

Props:
  coaching_cards: CoachingCard[]
```

### PRTimeline

```typescript
<PRTimeline prs={[
  {
    id: "uuid",
    number: 456,
    title: "Add login",
    merged_at: "2026-07-08T10:00:00Z",
    additions_count: 250,
    deletions_count: 100,
    files_changed_count: 5,
    scores: {
      code_quality: 85,
      bug_risk: 15,
      architecture: 82,
      test_coverage: 88
    }
  }
]} />

Props:
  prs: PR[]
```

---

## Next Steps

- Phase 5.2: Growth Path (60/90-day trends, compare periods)
- Phase 5.3: Coaching Card Details (click quest for detailed feedback)
- Phase 5.4: Feedback Thumbs (helpful/not helpful voting)

---

## Known Limitations

- **Real-time:** Dashboard doesn't auto-refresh (refresh page to see new scores)
- **Offline:** No offline support (requires API connection)
- **Mobile:** Timeline may be cramped on very small screens (< 320px)
- **Accessibility:** Some SVG content may not be fully screen-reader accessible
