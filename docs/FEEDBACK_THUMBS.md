# Feedback Thumbs — Phase 5.4

Complete guide to idempotent voting on coaching feedback.

---

## Overview

**Purpose:** Allow developers to rate coaching feedback helpfulness (👍 yes / 👎 no).

**Benefits:**
- Coaches learn which feedback resonates
- Managers identify most impactful guidance
- Community signal: helps surface helpful coaching items
- Developers engage with feedback (not passive recipients)

**Mechanism:** Idempotent voting — developers can change their vote anytime, last vote wins.

---

## Voting System

### Core Mechanics

**Vote Types:**
- **Helpful (👍):** Feedback was useful
- **Not Helpful (👎):** Feedback was not useful
- **No Vote:** Developer hasn't voted yet

**Idempotent Behavior:**
- Voting the same way twice: vote recorded once (no duplicate)
- Changing vote: old vote replaced
- Clicking same button twice: vote removed
- Each developer has max 1 vote per coaching card

### Data Model

**Table: coaching_feedback_votes**
```
coaching_card_id (FK)
developer_id (FK)
helpful BOOLEAN
voted_at TIMESTAMP
UNIQUE(coaching_card_id, developer_id)
```

**Table: coaching_card_vote_summary**
```
coaching_card_id (FK) UNIQUE
helpful_count INTEGER
unhelpful_count INTEGER
total_votes INTEGER
helpful_percentage DECIMAL(5,2)
```

### Vote Triggers

Three database triggers auto-update `coaching_card_vote_summary`:
1. **INSERT:** New vote → recalculate summary
2. **UPDATE:** Vote changed → recalculate summary
3. **DELETE:** Vote removed → recalculate summary

Summary updates automatically with 0 network calls.

---

## UI Components

### Compact Mode (Modal)

**Used in:** Coaching card modal (Phase 5.3)

**Layout:**
```
Was this helpful?  [👍] [👎]  75% helpful (4 votes)
```

**Features:**
- Inline with text
- Small buttons (px-2 py-1)
- Vote count shown
- Tight spacing for modals

**Colors:**
- Selected helpful: `bg-green-100 border-green-300`
- Selected not helpful: `bg-red-100 border-red-300`
- Unselected: `bg-gray-100` with hover

### Full Mode (Detail Page)

**Used in:** Coaching detail page (Phase 5.3)

**Layout:**
```
Was this feedback helpful?

[👍 Yes, helpful]  [👎 Not helpful]  |  Community feedback
                                       [progress bar]
                                       75% • 3 helpful, 1 not helpful

✓ Your vote: 👍 Helpful (click again to remove)
```

**Features:**
- Large buttons with labels
- Progress bar showing percentage
- Vote breakdown (helpful vs not)
- "No votes yet" placeholder
- "Your vote" indicator
- Toggle to remove vote

**Colors:**
- Selected helpful: `bg-green-200 border-green-500`
- Selected not helpful: `bg-red-200 border-red-500`
- Unselected: white with hover
- Progress bar: `bg-green-500`

---

## Vote Lifecycle

### User votes helpful

```
1. Click 👍 button
2. FeedbackThumbs.voteOnCoachingCard(card_id, helpful=true)
3. Library calls: voteOnCoachingCard(supabase, card_id, true)
4. Upsert to coaching_feedback_votes
   (coaching_card_id, developer_id) UNIQUE constraint
5. Trigger fires → update coaching_card_vote_summary
6. FeedbackThumbs re-fetches summary
7. UI updates: button shows selected, summary reflects new vote
```

### User changes vote (helpful → not helpful)

```
1. Click 👎 button (was 👍 before)
2. Old vote helpful=true replaced with helpful=false
3. UPSERT with same (card_id, dev_id) key
4. Trigger updates summary
5. UI: thumbs down shows selected, thumbs up unselected
6. Summary: vote count same, percentage flips
```

### User removes vote (click same button twice)

```
1. Click 👍 button (currently showing as selected)
2. Function detects userVote === true, converts to null
3. Calls removeVote() instead of voteOnCoachingCard()
4. DELETE from coaching_feedback_votes
5. Trigger updates summary (vote_count decreases)
6. UI: both buttons show unselected
7. Summary: vote count decreases by 1
```

---

## Helpfulness Calculation

### Percentage Formula

```typescript
helpful_percentage = (helpful_count / total_votes) * 100
rounded to 2 decimals

Examples:
- 3 helpful, 1 not helpful → 75.00%
- 2 helpful, 2 not helpful → 50.00%
- 5 helpful, 0 not helpful → 100.00%
- 0 votes → NULL (no percentage)
```

### Vote Count Labels

| Scenario | Label |
|----------|-------|
| 0 votes | "No votes yet" |
| 1 vote | "1 vote" |
| 4 votes | "4 votes" |
| 75% helpful | "75% helpful (4 votes)" |

### Visual Representation

**Progress Bar (full mode only):**
- Width = helpful_percentage
- Color: `bg-green-500`
- Background: `bg-gray-200`
- Shows at a glance: is this coaching helpful?

---

## Security & Permissions

### Row-Level Security

**Insert Policy:**
- User must own the vote (developer_id = auth.uid())
- Coaching card must be in user's workspace

**Select Policy:**
- User can see votes for coaching cards in their workspace

**Update Policy:**
- User can only update their own vote

**Delete Policy:**
- Handled by removeVote() function

### Cross-Workspace Isolation

- Developer A in workspace 1 can't see coaching cards from workspace 2
- Vote counts only visible to workspace members
- No leakage between workspaces

---

## Integration Points

### In CoachingCardModal

```typescript
<FeedbackThumbs coaching_card_id={card.id} compact={true} />
```

- Placed before metadata section
- Compact mode with small buttons
- No progress bar (saves space)

### In CoachingCardDetailView

```typescript
<FeedbackThumbs coaching_card_id={card.id} compact={false} />
```

- Placed before metadata section
- Full mode with progress bar + breakdown
- Large buttons with labels

### Component Props

```typescript
interface FeedbackThumbsProps {
  coaching_card_id: string;  // Required
  compact?: boolean;         // Optional, default false
}
```

---

## Analytics & Reporting

### Manager View (Future)

Managers could see:
- Which coaching items have highest helpfulness score
- Which coaches give most helpful feedback
- Trends over time (is coaching getting better?)

### Example Query

```sql
SELECT 
  coaching_card_id,
  title,
  helpful_percentage,
  total_votes,
  helpful_count
FROM coaching_card_vote_summary
WHERE helpful_count > 0 OR total_votes > 3
ORDER BY helpful_percentage DESC;
```

---

## Performance

### Database Queries

**Per vote action:** 2-3 queries total
- Upsert/delete vote: 1 query (idempotent)
- Trigger updates summary: automatic
- Fetch summary: 1 query
- Fetch user vote: 1 query

**Caching opportunities:**
- Vote summary cached on component (re-fetch on vote)
- Could cache in Redis if needed

### No N+1 Problem

- Summary table pre-computed by triggers
- No need to count votes on each request
- Single query to get helpfulness stats

---

## Error Handling

### Network Errors

If vote fails:
- Keep UI in pending state
- Show error message
- Allow user to retry
- Don't update local state until confirmed

### Authentication Errors

- User must be authenticated to vote
- Graceful error if session expires mid-vote

### Constraint Violations (Race Conditions)

- Concurrent votes on same card by same user
- Database UNIQUE constraint prevents duplicates
- Last vote wins (UPSERT semantics)
- Trigger ensures summary stays consistent

---

## Accessibility

### Keyboard Navigation

- Tab to thumbs buttons
- Enter/Space to vote
- Focus indicators visible
- Aria-labels on buttons (for screen readers)

### Screen Reader

- "Was this helpful?" read as heading
- "Yes, helpful" and "Not helpful" button labels read
- Vote summary percentage announced
- "Your vote" indicator announced

### Color Contrast

- All text on colored buttons WCAG AA compliant
- Not relying on color alone (text labels present)
- Progress bar has sufficient contrast

---

## Future Enhancements

### Phase 5.5+

- **Comment on vote:** "Why unhelpful?" feedback
- **Vote trends:** Show helpfulness over time
- **Coach analytics:** Coaches see which feedback resonates
- **Recommendations:** Suggest high-helpfulness coaching items
- **Leaderboard:** Coach rankings by helpfulness
- **A/B testing:** Test different coaching approaches

---

## Testing

### Test Coverage (TC-THUMB-001 through TC-THUMB-030)

- Basic voting: up, down, change, remove
- Vote display: summary, user vote state, empty state
- Real-time updates: vote count changes live
- Idempotency: duplicate votes don't create duplicates
- Persistence: votes survive page reload
- Isolation: votes per developer, per card
- Accessibility: keyboard nav, screen reader
- Error handling: network, auth, constraints

---

## Component API Reference

### FeedbackThumbs Component

```typescript
<FeedbackThumbs
  coaching_card_id="uuid-1234"
  compact={true}
/>
```

**Props:**
- `coaching_card_id` (required): UUID of coaching card
- `compact` (optional, default false): Show compact or full layout

**Behavior:**
- Auto-fetches user's vote on mount
- Auto-fetches vote summary on mount
- Re-fetches summary after voting
- Handles all voting logic internally

### Library Functions

```typescript
// Vote on a card
await voteOnCoachingCard(supabase, card_id, helpful: boolean)
// Returns: FeedbackVote object

// Get user's vote
const vote = await getUserVote(supabase, card_id)
// Returns: FeedbackVote or null

// Get vote summary
const summary = await getVoteSummary(supabase, card_id)
// Returns: VoteSummary { helpful_count, unhelpful_count, total_votes, helpful_percentage }

// Remove vote
await removeVote(supabase, card_id)
// Returns: boolean success

// Format label
const label = getHelpfulnessLabel(summary)
// Returns: "75% helpful (4 votes)" or "No votes yet"
```

---

## Known Limitations

- No "neutral" option (only yes/no)
- No comment/reason required (just thumbs)
- Summary visible to all (not private to user)
- Vote counts reset never (no time-decay)
- No weighted voting (all votes = 1 point)

---

## Files

```
lib/
  feedback-votes.ts           # Vote library (voteOnCoachingCard, etc.)

components/dashboard/
  FeedbackThumbs.tsx          # Vote component (compact + full modes)
  CoachingCardModal.tsx (updated)       # Integrated compact thumbs
  CoachingCardDetailView.tsx (updated)  # Integrated full thumbs

supabase/migrations/
  20260709120000_feedback_thumbs.sql   # Tables + triggers

tests/
  feedback-thumbs.test.ts     # 30 test placeholders
```
