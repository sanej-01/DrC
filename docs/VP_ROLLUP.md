# VP Rollup — Phase 8.2

Read-only organization and team composite dashboard for executives.

---

## Overview

**Purpose:** Executives view organization-wide performance portfolio with team health indicators and early warnings.

**Access:** Managers+ (read-only)

**Key Features:**
- Organization overview (developers, teams, avg score, PR volume)
- Team aggregates table (sortable, filterable)
- Early warning cards (declining teams, low quality)
- Workspace trend indicator

---

## Data Model

### team_aggregates Table

```sql
CREATE TABLE team_aggregates (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  team_name TEXT,
  -- 30/60/90-day metrics: quality, risk, architecture, tests, overall
  avg_code_quality_30d DECIMAL(5,2),
  overall_score_30d DECIMAL(5,2),
  developer_count INTEGER,
  total_prs_30d INTEGER,
  trend TEXT, -- 'improving', 'stable', 'declining'
  last_computed_at TIMESTAMP
);
```

### early_warnings Table

```sql
CREATE TABLE early_warnings (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  team_id UUID,
  team_name TEXT,
  warning_type TEXT, -- 'score_drop', 'low_velocity', 'quality_risk', 'retention_risk'
  severity TEXT, -- 'info', 'warning', 'critical'
  title TEXT,
  description TEXT,
  status TEXT -- 'active', 'acknowledged', 'resolved'
);
```

### workspace_snapshots Table

```sql
CREATE TABLE workspace_snapshots (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  total_developers INTEGER,
  total_teams INTEGER,
  total_prs_30d INTEGER,
  avg_score_30d DECIMAL(5,2),
  teams_improving INTEGER,
  teams_stable INTEGER,
  teams_declining INTEGER,
  critical_warnings INTEGER,
  trend TEXT, -- 'improving', 'stable', 'declining'
  created_at TIMESTAMP
);
```

---

## API Endpoint

### GET /api/vp/portfolio

Fetch dashboard data: teams, warnings, snapshot.

**Response:**
```json
{
  "teams": [
    {
      "team_name": "Platform Squad",
      "overall_score_30d": 82,
      "developer_count": 5,
      "total_prs_30d": 12,
      "trend": "improving"
    }
  ],
  "warnings": [
    {
      "team_name": "DevOps",
      "severity": "critical",
      "title": "Score drop detected",
      "description": "DevOps team score dropped from 75 to 65"
    }
  ],
  "snapshot": {
    "total_developers": 20,
    "total_teams": 4,
    "avg_score_30d": 78,
    "teams_improving": 2,
    "teams_stable": 1,
    "teams_declining": 1,
    "trend": "stable"
  }
}
```

---

## UI Component: VPPortfolio

Read-only dashboard with:

1. **Workspace Overview** (4-card summary)
   - Total developers + team count
   - Avg 30-day score + PR volume
   - Team health (improving/stable/declining counts)
   - Org trend + critical alert count

2. **Early Warnings** (collapsible section)
   - 5 most recent active warnings
   - Color-coded by severity (critical/warning/info)
   - Team name, title, description

3. **Teams Table** (sortable)
   - Team name
   - 30-day score
   - Quality, risk (inverted), architecture, tests
   - Developer count, PR count
   - Trend (improving/stable/declining)

4. **Coming Soon** (placeholder)
   - Deep-dives, trends, benchmarking
   - Retention signals, custom goals

---

## Trend Calculation

```
if (score_30d - score_90d > 5) → "improving"
if (score_30d - score_90d < -5) → "declining"
else → "stable"
```

---

## Files

```
supabase/migrations/
  20260709160000_vp_rollup.sql      # Tables + RLS

lib/
  vp-rollup.ts                      # Helper functions

app/api/vp/
  portfolio.ts                      # API endpoint

components/vp/
  VPPortfolio.tsx                   # Dashboard component

docs/
  VP_ROLLUP.md                      # This guide
```

---

## Tests

Placeholder tests (TC-VP-001 through TC-VP-020) in `tests/vp-rollup.test.ts`.

---

## Future Enhancements

- Team deep-dives with developer breakdown
- Historical trend charts (quarterly)
- Peer benchmarking
- Retention and engagement metrics
- Custom goal tracking
