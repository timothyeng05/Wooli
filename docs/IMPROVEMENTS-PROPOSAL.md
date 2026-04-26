# Wooli — Improvement Proposal

_Written by Opus 4.7 on 2026-04-25 after reviewing the deployed app._

This is a prioritized list of improvements. Each item is sized so Sonnet can pick it up independently. Items marked **[S]** are small (under 10 min), **[M]** medium (10–30 min), **[L]** large (more than 30 min, may need design discussion).

---

## P0 — Real bugs / broken UX

### 1. Date timezone bug in mood + transaction forms **[S]**
**Where:** `app/components/mood/MoodFormClient.tsx:39`, `app/components/budget/TransactionForm.tsx:51`
**Problem:** `new Date('2026-04-25').toISOString()` produces `2026-04-25T00:00:00.000Z`, which is interpreted as midnight UTC. Users west of UTC see the entry shift to the previous day in display. Already proven inconsistent because `TransactionList.tsx:67` works around it with `new Date(date + 'T12:00:00')`.
**Fix:** Append local noon (`'T12:00:00'`) before converting, or store as date-only.

### 2. Sign-out is only on the dashboard **[S]**
**Where:** `app/page.tsx:75-79` (only place with a logout button)
**Problem:** Once a user navigates into a module, the only way to sign out is to go back to the dashboard. Discoverability problem.
**Fix:** Move the logout form into `Nav.tsx` as a small icon/menu on the right.

### 3. Debug code visible in production **[S]**
**Where:** `app/cards/new/page.tsx:88-92` dumps raw JSON + error objects to the user when no templates load. `app/cards/new/page.tsx:31` has `console.log('Raw templates:', rawTemplates)`.
**Fix:** Replace dump with a friendly empty state. Remove console.logs from `cards/new`, `cards/compare`, `api/create-card`, `api/cleanup-and-seed`, `api/seed-csr`, `api/check-templates`, `api/sync-benefits`, `MoodFormClient.tsx`, `TemplatesWaiter.tsx`, `CardTemplateSelector.tsx`.

### 4. One-shot seed/cleanup API routes are still live **[M]**
**Where:** `app/api/cleanup-and-seed/route.ts`, `app/api/seed-csr/route.ts`, `app/api/check-templates/route.ts`
**Problem:** These endpoints exist for one-time data setup. They're publicly callable in production with no auth check, and `cleanup-and-seed` deletes data. Anyone who guesses the URL can wipe seed data.
**Fix:** Either gate behind a server-side check (`process.env.NODE_ENV === 'development'` or admin user check) or delete after the data is seeded.

---

## P1 — Visual consistency

### 5. Brand color confusion (pink vs blue) **[M]**
**Where:** `app/login/page.tsx`, `app/signup/page.tsx`, `app/cards/[id]/redeem/page.tsx`, `app/cards/[id]/edit-rates/page.tsx` use `from-primary-500 to-primary-400` (hot pink). The rest of the app — nav, dashboard, all module pages — uses `bg-blue-600` for primary actions.
**Problem:** App feels like two products. New users see pink login, then never see pink again until they hit redeem/edit-rates deep in the cards module.
**Fix:** Pick one. Recommendation: keep blue everywhere (it's the established pattern); restyle login/signup/redeem/edit-rates to match. Or commit to the pink as the brand and convert the rest. The easier route is the former.

### 6. Page header padding inconsistency **[S]**
**Where:** Most pages use `py-8` after the breadcrumb addition; `app/cards/[id]/page.tsx` and the new pages use `py-6`. The `/login` and `/signup` pages have their own pattern.
**Fix:** Standardize on `py-8` for hero headers, `py-6` for breadcrumb-only headers.

---

## P2 — Missing UX

### 7. No user profile / settings page **[L]**
**Problem:** Profile table exists (`profiles.full_name`, `username`, `avatar_url`, `timezone`) but there's no UI to edit any of it. Dashboard greets with `user.email`.
**Fix:** Add `/settings` route with name/timezone form. Use `profile.full_name` in the dashboard greeting (`app/page.tsx:72`) when available.

### 8. Replace `alert()` and `confirm()` with proper toast / modal **[M]**
**Where:** `MoodFormClient.tsx`, `MoodDetailClient.tsx`, `TransactionForm.tsx`, `JournalDeleteButton.tsx`, several Card components
**Problem:** Browser alerts feel hacky and break the visual design.
**Fix:** Add a lightweight toast component (e.g. `app/components/Toast.tsx`) and a confirm modal. ~50 lines each.

### 9. Mood "activities" list is hardcoded **[M]**
**Where:** `app/components/mood/MoodFormClient.tsx:7`
**Problem:** Only `Exercised, Read, Good sleep, Meditated, Period`. Can't add "Drank water", "Stretched", "Phone call w/ family", etc.
**Fix:** Either (a) move list to a `user_activities` table, or (b) allow free-text "+ Add activity" input that persists per-user.

### 10. No streaks / insights for journal **[M]**
**Problem:** Mood data is tracked daily but the only view is the calendar heatmap. A header showing "5 days in a row · avg mood 4.1 last 7 days" would make logging feel rewarding.
**Fix:** Compute on `app/mood/page.tsx`, render above the entry list.

### 11. Budget month navigation **[M]**
**Where:** `app/budget/page.tsx`
**Problem:** Hard-coded to current month. No way to view last month or any historical month.
**Fix:** Add prev/next month chevrons in the header (mirror the calendar pattern in `MoodCalendar.tsx`).

### 12. Empty-state on dashboard **[S]**
**Where:** `app/page.tsx`
**Problem:** Brand-new user sees an empty calendar, "No transactions this month", and "No active cards yet" — all empty boxes. No onboarding cue.
**Fix:** When all three modules are empty, show a single "Welcome to Wooli — pick a place to start" panel with three call-to-action cards instead of three barren widgets.

### 13. Sticky bottom-nav on mobile **[M]**
**Where:** `app/components/Nav.tsx`
**Problem:** Top nav requires reaching to the top of the screen on mobile. Phone-app convention is bottom tab bar.
**Fix:** On `<sm` screens, render the nav as a fixed bottom bar with icons + labels. Keep top nav for `≥sm`.

---

## P3 — Code health

### 14. Heavy use of `as any` **[M]**
**Where:** Search shows `as any` casts in `app/page.tsx`, `app/cards/page.tsx`, `app/cards/[id]/page.tsx`, `app/budget/page.tsx`, `app/cards/compare/page.tsx`, several others.
**Problem:** Loses type safety on the most data-heavy queries — exactly where bugs hide.
**Fix:** Generate Supabase types via `mcp__supabase__generate_typescript_types` (or `npx supabase gen types`) into `types/database.ts`, then type the query results properly.

### 15. Server-side data fetching is repeated, not factored **[M]**
**Where:** Card detail and dashboard both fetch cards with the same nested `card_benefits → benefits` joins; `computeCardStats` is called in both places but the query is duplicated.
**Fix:** Extract `getCardsWithStats(userId)` and `getCardWithBenefits(cardId, userId)` into `lib/cards.ts`. Reduces drift when schema changes.

### 16. Compare page does an XLSX import on every page load **[L]**
**Where:** `app/cards/compare/page.tsx:8-132` reads `public/data/benefits.xlsx`, parses it, and upserts dozens of rows on every visit (only when templates count is 0, but still — the Excel parse runs).
**Problem:** Slow first load + couples runtime to a static file in `public/`. The seed should run once via migration or admin action.
**Fix:** Move the sync to a one-shot script in `scripts/seed-benefits.ts`. Keep it out of the request path.

### 17. Mixed import styles for Supabase clients **[S]**
**Where:** `app/cards/new/page.tsx:3-4` imports both `createServerSupabaseClient` and the raw `createServerClient` from `@supabase/ssr` to bypass RLS. Same pattern is in `app/api/create-card/route.ts`.
**Fix:** Add `lib/supabase-admin.ts` that exports a single `createAdminClient()` — avoids duplicating the service-role-with-empty-cookies boilerplate.

### 18. Middleware deprecation warning **[S]**
**Where:** Build log: `The "middleware" file convention is deprecated. Please use "proxy" instead.`
**Fix:** Rename `middleware.ts` → `proxy.ts` per Next.js 16 convention. (See https://nextjs.org/docs/messages/middleware-to-proxy referenced in the build output.)

---

## P3 — Future ideas (no commitment)

- **Card recommendation engine** — given a transaction, suggest the best card to use based on category and reward rates
- **CSV import** for transactions (Plaid is too much; CSV from bank statements is realistic)
- **Data export** — let user download their journal entries / transactions as CSV
- **Recurring transactions** — mark a transaction as recurring, auto-create the next one
- **Benefit usage tracking** — already partially built (the `usage_data` field exists on `card_benefits`), but no UI to log usage
- **Annual fee renewal reminders** — show "card renews in 23 days" banner if user might want to cancel

---

## Suggested order for Sonnet to attack

1. P0 items 1–4 (all small, high impact)
2. P1 item 5 (color consistency — shapes the rest of the visual work)
3. P2 items 8 + 12 (toast/modal + dashboard empty state — improves baseline UX)
4. P3 item 14 (Supabase types — pays back over every future change)
5. Then anything else the user prioritizes

---

## Out of scope notes

I deliberately did not propose:
- Test coverage (no tests exist; adding them is a project-level decision, not a polish fix)
- Auth providers beyond email/password
- Real-time updates / Supabase subscriptions
- Performance profiling — site is small enough that this is premature
