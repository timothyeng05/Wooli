# Issues

_Tracked here. Source of truth for known bugs and small improvements._

## Open

### P0 — Bugs

| # | Title | File(s) | Notes |
|---|-------|---------|-------|
| 4 | One-shot seed/cleanup API routes are public + destructive | `api/cleanup-and-seed`, `api/seed-csr`, `api/check-templates` | Gated to dev-only |

### P1 — Visual

| # | Title | File(s) | Notes |
|---|-------|---------|-------|
| 5 | Brand color confusion (pink vs blue) | login, signup, cards/redeem, cards/edit-rates | Pick blue everywhere |
| 6 | Page header padding inconsistent | various | Standardize on py-8 |

### P2 — UX

| # | Title | File(s) | Notes |
|---|-------|---------|-------|
| 7 | No user profile / settings page | — | `/settings` route needed |
| 8 | Replace `alert()` / `confirm()` with toast / modal | multiple | Need Toast + ConfirmModal components |
| 9 | Hardcoded activities list | MoodFormClient.tsx | User-customizable wanted |
| 10 | No streaks / insights on journal page | mood/page.tsx | Header row: streak + avg mood |
| 11 | Budget month navigation | budget/page.tsx | Prev/next month chevrons |
| 12 | Empty state on dashboard | app/page.tsx | Welcome panel for new users |
| 13 | Sticky bottom-nav on mobile | Nav.tsx | Fixed bottom bar on small screens |

### P3 — Code Health

| # | Title | File(s) | Notes |
|---|-------|---------|-------|
| 14 | Heavy use of `as any` | multiple | Generate Supabase TypeScript types |
| 15 | Duplicated card data fetching | cards, dashboard | Extract to `lib/cards.ts` |
| 16 | XLSX import on every page load | cards/compare | Move to one-shot script |
| 17 | Mixed Supabase client imports | cards/new, api/create-card | Add `lib/supabase-admin.ts` |
| 18 | Middleware deprecation warning | middleware.ts | Rename to proxy.ts |

---

## Fixed

| # | Title | Fixed in |
|---|-------|----------|
| 1 | Date timezone bug shifts entries to previous day | 2026-04-26 |
| 2 | Sign-out only accessible from dashboard | 2026-04-26 |
| 3 | Debug JSON dump visible in production on cards/new | 2026-04-26 |
