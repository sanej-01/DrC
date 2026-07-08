# Accessibility Audit & Fix Guide — Phase 9.1

Quick start for running axe-core audits and fixing WCAG 2.1 AA violations.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install --save-dev axe-playwright axe-core
```

### 2. Run Tests
```bash
# All accessibility tests
npm run test:accessibility

# Specific page (e.g., dashboard)
npx playwright test tests/accessibility.test.ts --grep "Dashboard"

# Generate HTML report
npx playwright test tests/accessibility.test.ts --reporter=html
```

### 3. Review Results

The HTML report shows:
- **Page**: Which page was tested
- **Violations**: Issues found (color-coded by severity)
- **Suggestions**: How to fix each issue
- **Test Status**: Pass/Fail

### 4. Fix Violations

For each violation, follow the fix in `docs/ACCESSIBILITY.md`:

**Example: Color Contrast Issue**
```
VIOLATION: "color-contrast" on element <span class="text-red-500">88</span>
FIX: Change to darker red that meets 4.5:1 ratio
CHANGED: text-red-500 → text-red-700 or custom #C41C3B
```

---

## Common Fixes by Violation

### Focus Not Visible
```typescript
// BEFORE
<button className="px-4 py-2 bg-blue-600">Click</button>

// AFTER
<button className="px-4 py-2 bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
  Click
</button>
```

### Missing Alt Text on SVG
```typescript
// BEFORE
<svg viewBox="0 0 100 100">...</svg>

// AFTER
<svg viewBox="0 0 100 100" role="img" aria-label="Growth ring showing 88/100 score">
  ...
</svg>
```

### Unlabeled Form Input
```typescript
// BEFORE
<input type="text" placeholder="Ask a question..." />

// AFTER
<label htmlFor="question-input" className="sr-only">Ask a question</label>
<input id="question-input" type="text" placeholder="Ask a question..." />
```

### Live Region for Dynamic Content
```typescript
// BEFORE
<div>
  <p>{response}</p>
</div>

// AFTER
<div aria-live="polite" aria-label="AI response">
  <p>{response}</p>
</div>
```

### Table Headers Missing Scope
```typescript
// BEFORE
<thead>
  <tr>
    <th>Team</th>
    <th>Score</th>
  </tr>
</thead>

// AFTER
<thead>
  <tr>
    <th scope="col">Team</th>
    <th scope="col">Score</th>
  </tr>
</thead>
```

### Color-Only Information
```typescript
// BEFORE (color only)
<span className="text-red-600">⚠️</span>

// AFTER (color + text)
<span className="text-red-600 font-semibold">🔴 Critical</span>
```

### Heading Structure
```typescript
// BEFORE (skips h2)
<h1>Dashboard</h1>
<h3>Metrics</h3>

// AFTER (proper order)
<h1>Dashboard</h1>
<h2>Metrics</h2>
<h3>Quality Score</h3>
```

---

## Testing Steps

### 1. Run Automated Tests
```bash
npm run test:accessibility
```

### 2. Review Report
- Look for CRITICAL issues (must fix)
- Look for SERIOUS issues (should fix)

### 3. Manual Testing (Keyboard)
- Open page in browser
- Press `Tab` repeatedly, verify:
  - Focus always visible (blue ring)
  - Can reach all interactive elements
  - Can escape modals with `Escape`
  - Buttons activate with `Enter`/`Space`

### 4. Apply Fixes
For each violation:
1. Locate element in source code
2. Apply fix from list above
3. Save file

### 5. Re-test
```bash
npm run test:accessibility
```
Verify no new violations introduced.

---

## Key Violations to Watch

| Component | Common Issue | Fix |
|-----------|--------------|-----|
| Growth Ring | Missing aria-label | Add `aria-label="Score"`  |
| Dimension Tiles | Focus ring missing | Add `focus:ring-2` class |
| Coaching Modal | No escape key | Add `onKeyDown` handler |
| Coach Panel | Input unlabeled | Add `<label>` + `htmlFor` |
| Team Table | Headers missing scope | Add `scope="col"` |
| Alert Icons | Color-only severity | Add text label ("Critical") |
| Wave Chart | Chart not labeled | Add `role="img"` + `aria-label` |
| Buttons | Text contrast low | Use darker color (≥ 4.5:1) |

---

## Pages to Fix (in order)

1. ✅ Coaching Card Modal — close button, focus trap, headings
2. ✅ Developer Dashboard — growth ring, tiles, color contrast
3. ✅ Growth Path — wave chart, timeline
4. ✅ Manager Team Garden — plant emojis (alt text), grid focus
5. ✅ Manager Drill-Down — table scope, trajectory chart
6. ✅ Coach Panel — input label, live region
7. ✅ VP Dashboard — table scope, severity labels

---

## Checklist Before Shipping

- [ ] All 25 accessibility tests pass
- [ ] Manual keyboard navigation works
- [ ] No CRITICAL violations in axe report
- [ ] No SERIOUS violations (ideally)
- [ ] Color contrast verified (4.5:1+)
- [ ] Screen reader tested (VoiceOver/NVDA) if possible
- [ ] Tested on desktop + tablet
- [ ] Escape key closes modals
- [ ] Tab order makes sense
- [ ] Focus always visible

---

## Resources

- **axe DevTools** (browser extension): Scan pages manually
- **WebAIM Contrast Checker**: Verify color ratios
- **NVDA** (Windows) or **JAWS**: Free screen reader
- **VoiceOver** (Mac/iOS): Built-in screen reader

