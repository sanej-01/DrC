# Team Garden — Phase 6.1

Manager view showing team development progress through garden metaphor.

---

## Overview

**Purpose:** Managers see team at a glance — which developers are thriving, which need support.

**Metaphor:** Team members are plants at different growth stages:
- 🌲 **Flourishing:** 85+ score (thriving)
- 🌳 **Mature:** 70-84 score (well-established)
- 🌿 **Sapling:** 40-69 score (developing)
- 🌱 **Seedling:** <40 or low confidence (building)
- 🚫 **No Data:** 0 PRs (haven't contributed yet)

**Access:** Managers+ only

---

## Growth Stages

### Flourishing (🌲)

- **Score Range:** 85–100
- **Meaning:** Excellent code quality, low bug risk, good architecture, strong test coverage
- **Action:** Recognize, leverage for mentoring others
- **Confidence:** ≥3 PRs in 30-day window

### Mature (🌳)

- **Score Range:** 70–84
- **Meaning:** Solid performance, room for minor improvements
- **Action:** Support growth to next stage, highlight specific areas
- **Confidence:** ≥3 PRs

### Sapling (🌿)

- **Score Range:** 40–69
- **Meaning:** Developing, visible growth, but needs focused coaching
- **Action:** Provide targeted feedback on weakest dimensions
- **Confidence:** ≥3 PRs

### Seedling (🌱)

- **Score Range:** <40 OR low confidence (<3 PRs)
- **Meaning:** Early stage, building fundamentals
- **Action:** Regular 1:1 coaching, celebrate small wins
- **Confidence:** Low (insufficient data) or genuine low score

### No Data (🚫)

- **PRs:** 0
- **Meaning:** New member, hasn't submitted code yet
- **Action:** Onboard, encourage first PR, no judgment on score
- **Display:** Hidden by default (toggle available)

---

## Data Model

### Garden Stats Endpoint

**GET `/api/manager/team/garden-stats?workspace_id=&includeZeroPR=false`**

Returns:
```json
{
  "members": [
    {
      "id": "uuid",
      "display_name": "Alice",
      "email": "alice@...",
      "github_handle": "alice-dev",
      "role": "developer",
      "stage": "flourishing",
      "pr_count": 12,
      "score_30d": 88,
      "confidence": "CONFIDENT",
      "dimensions": {
        "quality": 90,
        "bug_risk": 15,
        "architecture": 88,
        "tests": 92
      }
    }
  ],
  "stats": {
    "total_members": 8,
    "members_with_data": 7,
    "members_no_data": 1,
    "stage_breakdown": {
      "flourishing": 2,
      "mature": 3,
      "sapling": 2,
      "seedling": 0,
      "no_data": 1
    },
    "avg_score_30d": 72.5
  }
}
```

### Score Calculation

**Overall Score** = (quality + (100 - bug_risk) + architecture + tests) / 4

Bug risk is inverted because lower is better.

Example:
- Quality: 88
- Bug Risk: 15 → Inverted: 85
- Architecture: 88
- Tests: 92
- **Overall:** (88 + 85 + 88 + 92) / 4 = **88.25** → displayed as **88**

---

## UI Components

### GardenVisualization

Renders the full garden grid with:
- Header stats (total, with data, avg score, no data)
- Stage legend (all 5 stages with counts)
- Garden grid grouped by stage
- Per-member cards with scores and dimension breakdown

**Props:**
```typescript
interface GardenVisualizationProps {
  members: TeamMember[];
  stats: {
    total_members: number;
    members_with_data: number;
    members_no_data: number;
    stage_breakdown: Record<string, number>;
    avg_score_30d: number | null;
  };
}
```

### Manager Team Page

**Route:** `/app/manager/team`

**Features:**
- Toggle to show/hide no-data members
- Responsive grid (1 col mobile, 2 cols tablet, 3 cols desktop)
- Hover effects for interactivity
- Loading/error states

---

## Semantics: "No Data" vs "Score 0"

**Important distinction:**

| Scenario | Stage | Display | Reasoning |
|----------|-------|---------|-----------|
| Developer A: 5 PRs, all terrible | Seedling | 🌱 15/100 | Bad score = needs coaching |
| Developer B: 0 PRs | No Data | 🚫 | No judgment = just started |
| Developer C: 2 PRs (low confidence) | Seedling | 🌱⚠️ | Insufficient data → marked LOW_CONFIDENCE |

**Why this matters:**
- Prevents false negatives: a new dev isn't "bad," they're "building"
- Surfaces real problems: actual low scores appear in Seedling
- Managers can adjust expectations by stage

---

## Filtering & Display

### By Default

- Show all members with ≥1 PR (members_with_data)
- Hide no-data members (toggle available)

### Query Params

- `includeZeroPR=true`: Show no-data members
- `workspace_id=`: Required, specifies team

### Sorting

Garden displays by stage, alphabetical within stage.

---

## Manager Actions

### From Team Garden (6.1)

- View team overview
- See growth stage of each member
- Identify who needs support
- Celebrate high performers

### Future (6.2, 6.3)

- Drill down on individual (90-day trajectory, PR history)
- Add private notes to developers
- Track coaching progress

---

## RLS & Access Control

**Policies:**
- Managers can see team members and aggregates in their workspace
- Developers can see themselves but not team
- Admins see all

**Query:**
```sql
SELECT * FROM pr_aggregates
WHERE workspace_id IN (
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid() AND role IN ('manager', 'admin')
)
```

---

## Performance

**Queries:**
- Fetch memberships: 1 query
- Fetch aggregates: 1 query (per workspace)
- Compute stats: in-memory

**Caching:**
- No client-side caching (always fresh 30-day data)
- Could cache in Redis if needed

---

## Accessibility

- Color not sole indicator (text labels, emojis, badges)
- Responsive grid works on mobile
- Keyboard navigation: tab through cards
- Screen readers: semantic HTML, role hints

---

## Files

```
app/manager/
  team/
    page.tsx                 # Team garden page

components/manager/
  GardenVisualization.tsx    # Garden grid + stats

app/api/manager/team/
  garden-stats.ts           # Garden data endpoint

docs/
  TEAM_GARDEN.md            # This guide
```

---

## Tests

Placeholder tests (TC-GARDEN-001 through TC-GARDEN-030) in `tests/team-garden.test.ts`.

---

## Future Enhancements (Phase 6.2+)

- Trend over time: garden season cycle (spring → summer → autumn)
- Individual drill-down with 90-day trajectory
- Private manager notes
- Peer comparisons (anonymized)
- Coaching recommendations
- Historical snapshots ("as of 3 months ago")
