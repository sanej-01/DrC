# Accessibility — Phase 9.1

WCAG 2.1 Level AA compliance audit and fixes.

---

## Overview

**Standard:** WCAG 2.1 Level AA

**Tools:** axe-core (automated testing), manual keyboard navigation

**Target Screenshots:**
- Coaching card modal + detail page
- Developer dashboard + growth path
- Manager team garden + individual drill-down
- Coach panel (full + compact)
- VP portfolio dashboard

---

## Common Violations & Fixes

### 1. Color Contrast (WCAG 1.4.3)

**Violation:** Text color contrast < 4.5:1 (normal) or 3:1 (large text)

**Locations:**
- Score labels (e.g., "88/100" in growth ring)
- Dimension tiles (quality, risk, etc.)
- Warning/alert text colors

**Fix:**
- Use color palette: dark text (gray-900) on light bg, light text (white) on dark bg
- Verify: text color ≥ 4.5:1 contrast ratio
- Test with axe-core: `checkA11y(page, null, { rules: { 'color-contrast': { enabled: true } } })`

### 2. Missing Alt Text (WCAG 1.1.1)

**Violation:** Images/icons without alt text or aria-label

**Locations:**
- Growth ring SVG
- Wave chart SVG
- Team garden plant emojis
- Alert/warning icons

**Fix:**
- SVG charts: add `role="img"` + `aria-label="Chart showing..."`
- Icons: use `aria-label` if no adjacent text
- Emojis: context usually sufficient, verify with screen reader

### 3. Unlabeled Form Inputs (WCAG 1.3.1)

**Violation:** Input fields without associated `<label>` or `aria-label`

**Locations:**
- Coach panel question input
- Dashboard filter inputs
- Search fields

**Fix:**
- Add `<label for="input-id">` or `aria-label="Question input"`
- Ensure label programmatically associated

### 4. Missing ARIA Live Regions (WCAG 4.1.3)

**Violation:** Dynamic content updates not announced to screen readers

**Locations:**
- Coach panel responses appearing
- Alert notifications
- Vote count updates (feedback thumbs)

**Fix:**
- Add `aria-live="polite"` to content regions
- Use `aria-live="assertive"` for critical alerts
- Update content, screen reader announces automatically

### 5. Focus Not Visible (WCAG 2.4.7)

**Violation:** Keyboard focus indicator missing or insufficient contrast

**Locations:**
- All buttons, links, interactive elements
- Modal close button
- Table sortable headers

**Fix:**
- Use Tailwind's `focus:ring-2 focus:ring-blue-500` on interactive elements
- Ensure ≥ 3px visible outline or ring
- Test: Tab through page, verify blue ring appears

### 6. Heading Structure (WCAG 1.3.1)

**Violation:** Headings skip levels (h1 → h3, no h2)

**Locations:**
- Dashboard (should have h1 title, then h2 for sections)
- Coaching cards
- Manager views

**Fix:**
- Use semantic order: h1 (page title) → h2 (sections) → h3 (subsections)
- Don't skip levels for styling; use CSS instead

### 7. Table Headers Missing Scope (WCAG 1.3.1)

**Violation:** Table headers don't have `scope="col"` or `scope="row"`

**Locations:**
- Team aggregates table (VP dashboard)
- Coaching history table

**Fix:**
```html
<table>
  <thead>
    <tr>
      <th scope="col">Team Name</th>
      <th scope="col">Score</th>
    </tr>
  </thead>
</table>
```

### 8. Modal Focus Trap (WCAG 2.1.2)

**Violation:** Focus escapes modal when using Tab, or gets trapped forever

**Locations:**
- Coaching card modal
- Coach panel
- Alert modals

**Fix:**
- Trap focus within modal: Tab on last element → first element
- Close button should be reachable (usually at top right)
- Escape key should close modal

### 9. Color-Only Information (WCAG 1.4.1)

**Violation:** Meaning conveyed by color alone (no text label)

**Locations:**
- Alert severity (red/amber/blue only, no "Critical"/"Warning"/"Info" text)
- Trend indicators (📈 emoji alone, no "Improving" text)

**Fix:**
- Always pair colors with text labels
- Example: `<span className="text-red-600">🔴 Critical</span>` (color + text)

### 10. Keyboard Trap (WCAG 2.1.1)

**Violation:** User cannot escape a component using only keyboard

**Locations:**
- Dropdowns (alert tray) without Escape key handling
- Any modal without Escape key support

**Fix:**
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') {
    setOpen(false);
  }
};
```

---

## Testing Checklist

### Automated (axe-core)
- [ ] Run `npm run test:accessibility` on all key pages
- [ ] Fix all CRITICAL violations (must fix)
- [ ] Fix all SERIOUS violations (should fix)
- [ ] Review MODERATE violations (nice to have)

### Manual (Keyboard Navigation)
- [ ] Tab through entire page
- [ ] Verify focus is always visible (blue ring)
- [ ] Escape closes modals
- [ ] Enter/Space activates buttons
- [ ] Arrow keys work in dropdowns/menus

### Screen Reader (optional: NVDA, JAWS, VoiceOver)
- [ ] Page structure announced correctly
- [ ] Chart content accessible
- [ ] Form labels announced
- [ ] Live updates announced

### Visual Inspection
- [ ] Color contrast sufficient (4.5:1 for text)
- [ ] Text not too small (minimum 12px)
- [ ] Icons have labels or context
- [ ] Error messages clear

---

## Severity Levels

| Level | Action | Examples |
|-------|--------|----------|
| CRITICAL | MUST FIX | Color contrast < 3:1, missing alt text on functional images, keyboard traps |
| SERIOUS | SHOULD FIX | Missing form labels, focus not visible, heading skips |
| MODERATE | NICE TO HAVE | Minor contrast issues, verbose alt text, redundant ARIA |
| MINOR | OPTIONAL | Best practices, cosmetic issues |

---

## Key Pages to Audit

1. **Coaching Card** (`/dashboard/coaching/[cardId]`)
   - Check: close button (X), copy link button, modal focus trap, heading structure
   
2. **Development Dashboard** (`/dashboard`)
   - Check: growth ring accessible, dimension tiles focusable, color contrast

3. **Growth Path** (`/dashboard/growth-path`)
   - Check: wave chart labeled, timeline structure, heading order

4. **Manager: Team Garden** (`/manager/team`)
   - Check: garden grid interactive, filters accessible, toggle for zero-PR members

5. **Manager: Individual Drill** (`/manager/team/[developerId]`)
   - Check: trajectory chart, PR table headers have scope, note editor accessible

6. **Coach Panel** (full mode)
   - Check: input labeled, live region for responses, keyboard navigation

7. **VP Dashboard** 
   - Check: overview cards, team table sortable, warning severity not color-only

---

## Files

```
tests/
  accessibility.test.ts                 # 25 axe-core + manual tests

docs/
  ACCESSIBILITY.md                      # This guide

playwright.config.ts (updated)          # axe-playwright configured
```

---

## Running Tests

```bash
# Install axe-playwright
npm install --save-dev @axe-core/playwright

# Run accessibility tests
npm run test:accessibility

# Run single page
npx playwright test tests/accessibility.test.ts --grep "Dashboard"

# Generate report
npx playwright test --reporter=html tests/accessibility.test.ts
```

---

## Common Tailwind Classes for Accessibility

```typescript
// Focus visible
<button className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">

// Color contrast
<span className="text-gray-900 bg-white">High contrast</span>

// Skip link (optional, best practice)
<a href="#main" className="sr-only focus:not-sr-only">Skip to main</a>

// Aria labels
<svg aria-label="Growth ring showing 88/100 score">

// Live region
<div aria-live="polite" aria-label="Chat responses">
```

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
