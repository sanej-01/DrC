# Coaching Card Details — Phase 5.3

Complete guide to coaching card modal and detailed view.

---

## Overview

**Purpose:** Allow developers to drill into coaching feedback with full context, file:line links, and related feedback items.

**Two entry points:**
1. **Modal:** Click coaching card in dashboard Quests section (inline modal)
2. **Detail Page:** Navigate to `/app/dashboard/coaching/[cardId]` (full-page view)

---

## Coaching Card Modal

### What It Shows

Modal popup with:
- Full coaching card title + severity badge
- Dimension tag
- Complete description
- File location (if available) with copy button
- Related feedback items filtered for same dimension
- Action guidance based on severity
- Metadata (date created)

### Visual Design

**Modal Layout:**
```
Header (sticky)
├─ Icon + Title
├─ Severity Badge + Dimension Tag
└─ Close button (X)

Content (scrollable)
├─ Summary section
├─ File Location (if applicable)
├─ Related Feedback Items
├─ Action Guidance box
└─ Metadata

Footer (sticky)
└─ Close button
```

### Color Coding

- **GOOD (✨):** Green theme (`bg-green-50`, `border-green-500`)
- **IMPROVE (💡):** Blue theme (`bg-blue-50`, `border-blue-500`)
- **FIX (⚠️):** Red theme (`bg-red-50`, `border-red-500`)
- **SUGGEST (🎯):** Amber theme (`bg-amber-50`, `border-amber-500`)

### File Links

**Layout:**
```
File Location
[src/auth.ts:42]  [Copy] button
```

**Functionality:**
- Click "Copy" → Copies "src/auth.ts:42" to clipboard
- Button text changes to "✓ Copied" for 2 seconds
- Reverts to "Copy"

### Related Feedback

Shows all feedback items from the same PR, filtered to the same dimension.

**For each feedback item:**
- Icon + Title
- Severity label (badge)
- Description
- File:line link (clickable copy)
- Highlight: Primary coaching item marked as "⭐ This is the coaching item you selected"

### Action Guidance

Context-specific guidance based on severity:

| Severity | Guidance |
|----------|----------|
| **GOOD** | "This is a strength! Keep applying this pattern. Share knowledge. Be consistent." |
| **IMPROVE** | "Consider these suggestions. Small tweaks can help. Review similar code." |
| **FIX** | "Priority: Address this. Check related code. Plan a follow-up PR." |
| **SUGGEST** | "This is optional. Could simplify approach. Implement when ready." |

### Interaction

- **Open:** Click any coaching card in Quests section
- **Close:** Click X button, backdrop, or close button in footer
- **Copy:** Click file link copy button → copies to clipboard
- **Navigate:** Click PR number to go to PR (future enhancement)

---

## Coaching Detail Page

### What It Shows

Full-page view with:
- Back button to return to dashboard
- Large header with coaching card details
- File location section with full copy functionality
- All related feedback from the PR
- Highlighted primary coaching item
- Action guidance section
- Metadata

### URL Pattern

```
/app/dashboard/coaching/[cardId]
```

Example:
```
/app/dashboard/coaching/uuid-1234-5678-90ab
```

### Page Sections

**1. Back Navigation**
```
← Back to Dashboard
```
Click to return to `/app/dashboard`

**2. Header Card**
- Large icon + Title
- PR number
- Severity badge + Dimension tag
- Full description text

**3. File Location**
```
📍 File Location
src/auth.ts:42
[Copy Link button]
```

**4. All Feedback from This PR**
- List of all feedback items
- Filtered feedback grouped visually
- Primary item has special styling
- File:line clickable copy links
- "⭐ This is the coaching item you selected" marker

**5. Action Guidance Box**
- Severity-specific recommendations
- Color-coded box (blue-50 background)
- Bullet points for clarity

**6. Metadata**
- Created date
- Card ID

### Highlighting Primary Item

The coaching card being viewed is highlighted:
- Colored header background (matches severity)
- "⭐ This is the coaching item you selected" text
- Different styling from other feedback items

### Responsive Design

**Desktop:** Full width, multi-column layout

**Tablet/Mobile:** 
- Stacked layout
- File link text wraps
- Copy button inline with file path
- Feedback items stack vertically

---

## Data Fetching

### Modal Data

**From:** Quests component props
- No additional fetch needed
- Data passed from parent dashboard

### Detail Page Data

**Query 1: Fetch coaching card**
```sql
SELECT * FROM coaching_cards
WHERE id = [cardId]
```

**Query 2: Fetch related feedback**
```sql
SELECT * FROM scoring_feedback
WHERE pr_id = [card.pr_id]
ORDER BY created_at DESC
```

### Error Handling

- **Not authenticated:** "Not authenticated" + back button
- **Card not found:** "Coaching card not found" + back button
- **Fetch error:** "Failed to load coaching card" + back button

---

## Component API

### CoachingCardModal

```typescript
<CoachingCardModal
  card={coachingCard}
  isOpen={true}
  onClose={() => setSelectedCard(null)}
  feedbackItems={allFeedbackItems}
/>

Props:
  card: CoachingCard (required)
  isOpen: boolean (required)
  onClose: () => void (required)
  feedbackItems?: FeedbackItem[] (optional, default [])
```

### CoachingCardDetailView

```typescript
<CoachingCardDetailView
  card={coachingCard}
  feedbackItems={feedbackItems}
/>

Props:
  card: CoachingCard (required)
  feedbackItems: FeedbackItem[] (required)
```

---

## Integration

### Dashboard Integration

Updated `Quests.tsx`:
- Click card → open modal
- Modal state managed by Quests component
- Pass feedbackItems to modal for context

### Detail Page Integration

`app/dashboard/coaching/[cardId]/page.tsx`:
- Fetches coaching card by ID
- Fetches all feedback from PR
- Renders CoachingCardDetailView
- Handles errors gracefully

---

## File:Line Link Handling

### Copy Behavior

```typescript
const copyFileLink = (file_path?: string, line_number?: number) => {
  const link = line_number ? `${file_path}:${line_number}` : file_path;
  navigator.clipboard.writeText(link);
  // Show "Copied" feedback for 2 seconds
};
```

### Use Cases

1. **With line number:** `src/auth.ts:42` → Copy exact location
2. **File only:** `src/api.ts` → Copy file path
3. **No path:** No copy button shown
4. **IDE integration:** Developers can paste `file:line` into search or IDE

---

## Accessibility

### Modal Accessibility

- Backdrop is interactive (click to close)
- Close button prominent and accessible
- Focus trap inside modal (tab stays within)
- ARIA role="dialog"

### Keyboard Navigation

- Tab through file copy buttons
- Enter to copy link
- Escape to close modal (future enhancement)

### Screen Reader

- Semantic HTML: `<h2>`, `<h3>` headings
- Icon + text for severity (not color alone)
- Badge text read aloud
- File:line presented as focusable button

### Color Contrast

- Text on colored backgrounds WCAG AA compliant
- Badges have sufficient contrast
- Links underlined + color for visibility

---

## Performance Considerations

### Modal

- Modal data passed from parent (no fetch)
- Fast open/close (no delay)
- No heavy re-renders

### Detail Page

- Two queries: coaching_card + feedback items
- Indexed by pr_id for fast feedback fetch
- Feedback filtered client-side by dimension

### Bundle

- Modal: Pure React/CSS (no libraries)
- Detail page: Standard Next.js page (no heavy deps)

---

## Future Enhancements

### Phase 5.4+

- **Feedback Thumbs:** Helpful/not helpful voting on coaching items
- **PR Link:** Navigate to actual PR details
- **Code Preview:** Show actual code snippet in modal
- **Inline Editor:** Apply suggested changes directly
- **Coaching History:** Timeline of all coaching for developer
- **Similar Issues:** "Show me other instances of this issue"
- **Mark as Done:** Developer marks coaching item as addressed
- **Discussion:** Comments on coaching items

---

## File Structure

```
app/dashboard/coaching/
  [cardId]/
    page.tsx                  # Detail page

components/dashboard/
  CoachingCardModal.tsx       # Modal component
  CoachingCardDetailView.tsx  # Detail view component
  Quests.tsx (updated)        # Click to open modal

tests/
  coaching-details.test.ts    # 30 test placeholders
```

---

## Testing

### Test Coverage (TC-COACH-001 through TC-COACH-030)

- Modal interaction (open/close)
- Content display (severity, feedback, guidance)
- File link copying
- Detail page rendering
- Error handling
- Responsiveness
- Accessibility

---

## Known Limitations

- **Code preview:** No actual code snippet shown (future)
- **Inline editing:** Can't apply changes from modal
- **Comments:** No discussion thread
- **Real-time:** Page doesn't auto-refresh
- **Mobile:** File links may wrap awkwardly on very narrow screens

---

## Severity-Specific Guidance

### GOOD (✨)

```
This is a strength!
✓ Keep applying this pattern.
✓ Share knowledge with teammates.
✓ Be consistent in similar code.
```

### IMPROVE (💡)

```
Consider these suggestions
💭 Small tweaks can significantly improve quality.
💭 Review similar code for consistency.
💭 Implement when you have time.
```

### FIX (⚠️)

```
Priority: Address this
🔧 Check related code for the same issue.
🔧 Plan a follow-up PR if not critical now.
🔧 Prevents issues down the line.
```

### SUGGEST (🎯)

```
This is optional but worth considering
🎯 Could simplify or improve your approach.
🎯 Worth trying when you have a moment.
🎯 No urgency required.
```

---

## Next Steps

- Phase 5.4: Feedback Thumbs (helpful voting)
- Phase 6: Manager Experience
- Integration: Coach panel Q&A (Phase 8)
