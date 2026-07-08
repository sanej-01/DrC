# Coach Panel — Phase 8.1

Live "Ask Dr. Codium" AI coaching with role-safe context.

---

## Overview

**Purpose:** Developers and managers ask questions about performance, feedback, and growth with live LLM responses.

**Key Features:**
- Live server-side Anthropic API calls
- RLS-safe context (no raw diffs, aggregated data only)
- Role-based access (developers see own, managers see team)
- Chat history persistence
- Full and compact UI modes

---

## Data Model

### coach_questions Table

```sql
CREATE TABLE coach_questions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL (FK),
  user_id UUID NOT NULL (FK),
  subject_developer_id UUID (FK),
  question TEXT NOT NULL (max 1000 chars),
  response TEXT,
  model_name TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  status TEXT ('pending' | 'completed' | 'failed'),
  error_message TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### Coach Audit Log

Tracks all coaching queries for compliance:

```sql
CREATE TABLE coach_audit_log (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL (FK),
  coach_question_id UUID NOT NULL (FK),
  user_id UUID NOT NULL (FK),
  subject_developer_id UUID (FK),
  action TEXT,
  context_summary TEXT, -- What data sent (no raw diffs)
  model_used TEXT,
  created_at TIMESTAMP
);
```

---

## API Endpoints

### POST /api/coach/query

Submit coaching question and get AI response.

**Body:**
```json
{
  "workspaceId": "uuid",
  "subjectDeveloperId": "uuid",
  "question": "How can I improve my test coverage score?"
}
```

**Validation:**
- Question required, non-empty
- Max 1000 characters
- Cannot ask about other developers (privacy)
- Cannot request harmful actions (delete, drop, passwords)

**Process:**
1. Create pending question record
2. Build RLS-safe context (developer's scores + coaching)
3. Call Anthropic Claude Opus with system prompt + context + question
4. Update question with response, tokens, latency
5. Log to audit trail

**Response:**
```json
{
  "question": {
    "id": "uuid",
    "question": "How can I improve my test coverage score?",
    "response": "Your test coverage is currently 75%...",
    "status": "completed",
    "model_name": "claude-opus-4-1-20250805",
    "tokens_used": 142,
    "latency_ms": 1240,
    "completed_at": "2026-07-09T15:30:00Z"
  }
}
```

### GET /api/coach/query

Fetch coaching history.

**Query params:**
- `workspaceId` (required)
- `developerId` (required)

**Response:**
```json
{
  "questions": [
    {
      "id": "uuid",
      "question": "...",
      "response": "...",
      "status": "completed",
      "created_at": "2026-07-09T15:30:00Z"
    }
  ]
}
```

---

## Context Building

### RLS-Safe Context

Never sends:
- Raw PR diffs
- Full source code
- Sensitive commit messages

Always sends:
- 30-day aggregated scores (quality, risk, architecture, tests)
- PR count and confidence badge
- Recent 5 PRs with their scores
- Coaching card breakdown (GOOD/IMPROVE/FIX/SUGGEST counts)

**Example context:**
```
Developer Performance Context:

30-Day Aggregates:
- Code Quality: 88.0
- Bug Risk (inverted): 85.0
- Architecture: 82.0
- Test Coverage: 90.0
- PR Count: 5
- Confidence: CONFIDENT

Recent PRs (5 most recent):
1. PR #42 (7/9/2026) - Score: 88
2. PR #41 (7/8/2026) - Score: 82
3. PR #40 (7/7/2026) - Score: 91

Recent Coaching Feedback:
- GOOD: 3 items
- IMPROVE: 2 items
- FIX: 1 item
```

### System Prompt

Guides model to be helpful, safe, and grounded:

```
You are Dr. Codium, an expert code review coach helping developers improve.

Your role:
- Analyze performance metrics and coaching feedback
- Provide constructive, actionable guidance
- Celebrate strengths, address growth areas
- Stay grounded in data
- Keep responses concise (under 500 words)

Safety guidelines:
- Never make up or exaggerate scores
- Only reference data provided
- Don't suggest changes beyond developer control
- Respect privacy
- Focus on growth, not criticism
```

---

## Question Validation

Blocked questions:
- "What about [other developer]?" (privacy)
- "Delete X" or "Drop table" (security)
- "Password" or "token" or "secret" (data protection)

Allowed questions:
- "How can I improve my test coverage?"
- "What does 'low architecture score' mean?"
- "What testing patterns would help?"
- "Why did my score drop?"
- "How do I fix the bug_risk issue?"

---

## UI Component: CoachPanel

Two rendering modes.

### Full Mode

Dedicated coaching page at `/coach` or tab in developer dashboard.

**Layout:**
- Header: "Ask Dr. Codium" title + description
- Chat area: Full conversation history
- Input form: Text field + Send button
- Tips: Common question suggestions
- Auto-scroll to latest message

**Features:**
- Load chat history on mount
- Real-time typing indicator ("Thinking...")
- Show latency and model name
- Error messages with retry option
- Character counter on input

### Compact Mode

Inline widget on dashboard/detail pages.

**Layout:**
- Title: "💬 Ask Dr. Codium"
- Mini chat: Last 2 messages
- Input: Short text field (100 chars max)
- Submit: "Ask" button

**Features:**
- Shows last 2 questions/responses
- Shorter input limit
- "No questions yet" empty state
- Link to full coaching page

---

## Message States

| Status | UI | Behavior |
|--------|----|----|
| `pending` | Spinning indicator "Thinking..." | Awaiting model response |
| `completed` | Response shown, latency displayed | Ready for next question |
| `failed` | Red error alert with error_message | User can try again |

---

## Role-Based Access

### Developers

- Can ask about themselves only
- See their own coaching history
- Context includes only their scores/feedback

### Managers

- Can ask about their team members
- See team member's coaching history
- Context includes team member's scores/feedback
- Can use for 1-on-1 preparation

### Admins

- Can ask about anyone in workspace
- See full coaching history

---

## Performance & Cost

**Per query:**
- 1 DB query to create question (pending)
- Anthropic API call (~200-500 input tokens, ~300-500 output tokens)
- 1 DB update to save response
- 1 audit log entry

**Typical cost:** $0.003-0.01 per query (Opus pricing)

**Timeout:** 30 seconds (if model takes longer, return error)

---

## Security

### RLS Policies

- Developers see own questions only
- Managers see team questions
- Admins see all workspace questions
- No cross-workspace leakage

### Data Safety

- No raw diffs sent to model
- No credentials/secrets sent
- Question validation prevents harmful queries
- Audit trail for compliance

### Rate Limiting (Future)

Could add:
- Max 5 questions per developer per day
- Max 10 per manager per day
- Cooldown between queries (30 sec)

---

## Error Handling

### Network Errors

**Timeout:** After 30s, return error + save failed question

**API Error:** Return 500 with error message

**Validation Error:** Return 400 with reason

### User Errors

**Empty question:** Disable submit button, show placeholder

**Too long:** Character counter turns red, disable submit

**Invalid question:** Return 400 with reason

---

## Integration Points

### Developer Dashboard

Add compact CoachPanel widget:

```typescript
<CoachPanel
  workspaceId={workspaceId}
  developerId={developerId}
  compact={true}
/>
```

### Individual Developer Detail Page (Manager)

Add full or compact CoachPanel:

```typescript
<CoachPanel
  workspaceId={workspaceId}
  developerId={developerId}
  compact={false}
/>
```

### Dedicated Coaching Page

Create `/coach` route for full experience:

```typescript
export default function CoachPage() {
  return <CoachPanel workspaceId={...} developerId={...} compact={false} />;
}
```

---

## Files

```
supabase/migrations/
  20260709150000_coach_panel.sql           # Tables + RLS

lib/
  coach-panel.ts                           # Library functions

app/api/coach/
  query.ts                                 # Query API endpoint

components/coach/
  CoachPanel.tsx                           # Full + compact component

docs/
  COACH_PANEL.md                           # This guide
```

---

## Tests

Placeholder tests (TC-COACH-001 through TC-COACH-030) in `tests/coach-panel.test.ts`.

---

## Future Enhancements

- **Multi-turn conversation:** Remember context across questions
- **Follow-ups:** "Tell me more" button
- **Export:** Save coaching transcript
- **Shared coaching:** Managers share sessions with developers
- **Recommendations:** System suggests questions based on scores
- **Analytics:** Track most common questions
- **Coaching prompts:** Different system prompts per context (debug vs growth)
