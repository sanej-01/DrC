# Manager Notes — Phase 6.3

Private manager-only notes on individual developers.

---

## Overview

**Purpose:** Managers record private observations, coaching reminders, and one-on-one notes that are never visible to developers.

**Access:** Managers+ only, on individual developer detail page

**Visibility:** Manager-only (enforced by RLS)

---

## Data Model

### manager_notes Table

```sql
CREATE TABLE manager_notes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL (FK),
  developer_id UUID NOT NULL (FK),
  manager_id UUID NOT NULL (FK),
  content TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(workspace_id, developer_id)
);
```

**Key constraints:**
- One note per developer per workspace (UNIQUE constraint)
- Upsert semantics: saving overwrites previous note
- Tracks manager who last edited
- Tracks update timestamp for display

---

## API Endpoints

### GET /api/manager/team/[developerId]/notes

Fetch manager note for a developer.

**Query params:**
- `workspace_id` (required)

**Response:**
```json
{
  "note": {
    "id": "uuid",
    "workspace_id": "uuid",
    "developer_id": "uuid",
    "manager_id": "uuid",
    "content": "Alice is ramping up on TypeScript. Great engagement in 1-on-1s.",
    "created_at": "2026-07-08T10:00:00Z",
    "updated_at": "2026-07-09T14:30:00Z",
    "manager": {
      "display_name": "Bob Manager",
      "email": "bob@..."
    }
  }
}
```

Returns `{ "note": null }` if no note exists (not an error).

### POST /api/manager/team/[developerId]/notes

Create or update (upsert) manager note.

**Body:**
```json
{
  "content": "Private note text..."
}
```

**Validation:**
- `content` required, non-empty
- Max 5000 characters
- Returns 400 if invalid

**Response:** Same as GET (updated note object)

### DELETE /api/manager/team/[developerId]/notes

Delete manager note.

**Response:**
```json
{
  "success": true
}
```

---

## UI Component: ManagerNoteEditor

Inline note editor on individual developer page.

**Props:**
```typescript
interface ManagerNoteEditorProps {
  developerId: string;
  workspaceId: string;
  userRole?: string; // 'manager' | 'admin' | 'developer'
}
```

**Behavior:**
- Only renders if `userRole` is manager or admin
- Displays existing note (if any)
- Edit button to switch to edit mode
- In edit mode: textarea with character count, cancel/save buttons
- Delete button available on saved notes
- Timestamps show relative time (e.g., "5 min ago")
- Manager name shown on saved notes

**Modes:**

**Display Mode (no note):**
- "No private notes yet" message
- "Add Note" button

**Display Mode (with note):**
- Note content in gray box
- "Last updated by [manager] • [time ago]"
- Edit and Delete buttons

**Edit Mode:**
- Textarea (max 5000 chars, shown in counter)
- Character count
- Cancel and Save buttons
- Error message if save fails
- Save button disabled if content empty

---

## Security & Permissions

### RLS Policies

**View policy:** Only managers in workspace can see notes
```sql
workspace_id IN (
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid() AND role IN ('manager', 'admin')
)
```

**Insert policy:** Only the manager creating the note
```sql
manager_id = auth.uid() AND workspace_id IN (...)
```

**Update policy:** Manager in workspace can update
```sql
workspace_id IN (...)
```

**Delete policy:** Manager in workspace can delete
```sql
workspace_id IN (...)
```

**Developer deny policy:** Developers never see notes
```sql
FOR ALL USING (false) WITH CHECK (false)
```

### Enforcement

- `withManagerAuth` middleware on all endpoints
- RLS enforced at database layer
- Component hides itself if not manager role
- Cross-workspace isolation via workspace_id

---

## Use Cases

### Coaching Reminders
"Alice identified bug_risk as her weakest area. Focus next 1-on-1 on testing patterns."

### Performance Context
"Strong quarter, took on extra mentoring. Watch for burnout."

### Onboarding Notes
"Ramping up on codebase. Pair with Bob on architecture decisions."

### Follow-up Actions
"Action: Review PR #42 for architecture decisions. Next 1-on-1: discuss patterns."

### Behavioral Observations
"Very collaborative in code reviews. Consider for tech lead path."

---

## Integration Points

### Individual Developer Page

Manager notes appear at bottom of `/manager/team/[developerId]` page:

```
└─ Coaching history (Phase 6.2)
└─ 🔒 Private Manager Note (Phase 6.3)
   ├─ Display mode: Note content + edit button
   ├─ Edit mode: Textarea + save/cancel
   └─ Delete option
```

Accessible only to managers viewing that developer's profile.

---

## Timestamps

Relative timestamp display:
- < 1 min: "just now"
- < 1 hour: "X min ago"
- < 1 day: "Xh ago"
- < 1 week: "Xd ago"
- > 1 week: "M/D/YYYY"

Updated on every save, shows manager who made change.

---

## Limitations & Design Decisions

### One Note Per Developer
- Simpler UX than threaded comments
- Managers can update/append in single note
- UNIQUE constraint enforces one note per (workspace, developer) pair

### Plain Text Only
- No markdown, formatting, or rich text
- Prevents XSS, keeps notes readable
- Character limit (5000) prevents abuse
- Line breaks preserved in display

### No History/Audit Trail
- Only current note visible
- Previous versions lost on update
- Could add audit log in Phase 7+ if needed for compliance

### No Pinning or Visibility Rules
- All managers see all notes
- No "visible to developer" toggle
- Notes are always private to manager group

---

## Performance

**Queries per developer profile load:**
- 1 query to fetch note (or null)

**Caching:** None (always fresh, manager working with up-to-date notes)

**Character limit:** 5000 (reasonable for typical manager notes, prevents DB bloat)

---

## Accessibility

- Label: "Private Manager Note" with 🔒 emoji
- Textarea has placeholder text
- Character counter updates live
- Error messages in red
- Relative timestamps help readability
- Keyboard accessible: tab through buttons, enter to edit

---

## Files

```
supabase/migrations/
  20260709130000_manager_notes.sql           # Table + RLS

lib/
  manager-notes.ts                           # Library functions

app/api/manager/team/[developerId]/
  notes.ts                                   # API endpoints (GET/POST/DELETE)

components/manager/
  ManagerNoteEditor.tsx                      # UI component

app/manager/team/[developerId]/
  page.tsx (updated)                         # Integrated ManagerNoteEditor

docs/
  MANAGER_NOTES.md                           # This guide
```

---

## Tests

Placeholder tests (TC-NOTES-001 through TC-NOTES-030) in `tests/manager-notes.test.ts`.

---

## Future Enhancements (Phase 7+)

- Audit trail: view history of note changes
- Flagged notes: pin important notes to top
- Coaching correlation: link notes to coaching feedback
- Notification: alert manager when developer scores drop
- Scheduled reminders: "remember to discuss with Alice"
- Search: find notes across team
- Export: CSV of all notes for compliance

---

## Example

**Manager Bob** viewing Alice's profile:

1. Navigates to `/manager/team/alice-id?workspace_id=...`
2. Scrolls to "🔒 Private Manager Note" section
3. Sees existing note: "Alice is ramping up on TypeScript..."
4. Clicks "Edit" button
5. Textarea opens with current content
6. Appends: "✓ Merged first complex PR this week!"
7. Clicks "Save Note"
8. Note updates with "Updated by Bob Manager • just now"
9. Tomorrow, Bob sees the note again with timestamp "1d ago"

**Developer Alice** viewing her own profile:
- ManagerNoteEditor component hidden (not manager role)
- Does not see the note
- No indication that notes exist

