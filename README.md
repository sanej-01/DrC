# Dr. Codium MVP

AI coaching layer connected to GitHub — scores merged pull requests and provides private, growth-oriented feedback to developers and managers.

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account & project

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   - `.env.local` is pre-configured with Supabase credentials
   - Add GitHub App credentials in Phase 3
   - Add Anthropic API key in Phase 4

3. **Apply Supabase migrations:**
   ```bash
   # Option A: Via Supabase dashboard
   # 1. Go to https://app.supabase.com → Project → SQL Editor
   # 2. Create a new query and paste contents of: supabase/migrations/20260708000000_baseline.sql
   # 3. Run the query
   
   # Option B: Check if migrations applied
   npx tsx scripts/check-migrations.ts
   ```

4. **Run the dev server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

5. **Run tests:**
   ```bash
   npm test
   ```

6. **Lint:**
   ```bash
   npm run lint
   ```

## Build Phases

See `../ProjDrCodium/BUILD_LEDGER.md` for the full 43-unit plan.

### Narrower MVP (Phases 0–4)
- Phase 0: Foundation (Next.js scaffold, Supabase setup, CI)
- Phase 1: Data model & security
- Phase 2: Auth (Supabase + GitHub linking)
- Phase 3: Ingestion (GitHub webhooks + poller)
- Phase 4: Scoring (LLM scoring + aggregates)

### Full MVP (Phases 5–9)
- Phase 5: Developer UX
- Phase 6: Manager UX
- Phase 7: Disputes
- Phase 8: Coach panel & VP view
- Phase 9: Hardening & deploy

## Deployment

Deploys to Vercel (configured in Phase 9.3).

## Design System

Colors, typography, spacing, and components follow the Dr. Codium design system (see `app/globals.css`).

- **Primary:** Sage (#6f9a87)
- **Secondary:** Clay (#c08a6a)
- **Semantic:** Good, Warn, Bad
- **Font:** Inter (sans), SF Mono (monospace)

## Key Decisions

✅ Anti-surveillance framing (coaching, not ranking)
✅ Real GitHub App + webhooks from start
✅ Live Anthropic API scoring (Haiku→Sonnet)
✅ No raw PR diffs stored
✅ Supabase RLS on all tables
✅ Dedup by `pr_node_id` end-to-end

---

**Status:** Phase 0.2 Supabase setup complete. Next: Phase 0.3 (CI & ledger).
