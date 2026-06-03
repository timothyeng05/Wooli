# Transactions — Improvement Backlog

_Generated 2026-06-04. Pick up from here; check off items as they land._

## Done ✅

- **Uncategorized filter** — added `__uncategorized__` sentinel to FilterPanel + filter logic in TransactionList (both chip display and filter matching)
- **Summary bar always visible** — removed the "only show when active filters" gate; bar now shows count + totals for the current view at all times
- **Bulk actions scroll padding** — added `pb-24 md:pb-16` to list wrapper when bulk bar is visible so last rows aren't obscured

---

- **T-01** — ReviewSheet now has editable description + merchant fields; category replaced with CategoryPicker
- **T-02** — Date range filter added to FilterPanel + TransactionList (chips + filter logic)
- **T-03** — Recurring generator moved to `/api/cron/recurring` (runs daily at 6am); removed from page load
- **T-05** — ReviewSheet category picker replaced with CategoryPicker component
- **T-06** — Pending badge changed from "P" to "Pending"

---

## P1 — Bugs / broken UX

### [T-01] `TransactionReviewSheet` can't edit core fields
**What:** The quick-review sheet only lets you change category, owner, trip, and transfer flag. Amount, description, and merchant require navigating to `/budget/[id]` (full edit page).
**Where:** `app/components/budget/TransactionReviewSheet.tsx`
**Fix:** Add read-only amount display at top (already there). Add editable `description` and `merchant` text inputs above the category picker. Pass them into the `save()` payload. Medium — ~30 lines.

### [T-02] No date range filter
**What:** FilterPanel has account / category / owner / trip filters but no date filter. The page loads all-time data; there's no way to narrow to a month or custom range without scrolling past everything.
**Where:** `app/components/budget/FilterPanel.tsx`, `TransactionList.tsx`
**Fix:** Add a date-range screen to FilterPanel (start date, end date). Apply it as an additional filter in the `filtered` useMemo in TransactionList. Small change to FilterPanel UI (~40 lines), tiny change to filter logic.

---

## P2 — Missing UX

### [T-03] Recurring transaction generator runs on every page load
**What:** `app/budget/transactions/page.tsx:33-52` loops over due recurring transactions and inserts new ones on *every* request to the transactions page. This is a DB write on every page load and will produce duplicates if the page is loaded twice in the same day before the `next_date` is advanced.
**Where:** `app/budget/transactions/page.tsx`
**Fix:** Move this logic to `app/api/cron/sync/route.ts` (or a dedicated `/api/cron/recurring/route.ts`). Schedule it daily via Vercel Cron (`vercel.json` crons). Remove from page load path. Medium.

### [T-04] All transactions loaded into memory — no month scoping
**What:** The page fetches every transaction for the user (paginated 1000-at-a-time until exhausted). For a user with 2+ years of data this is hundreds of KB on every page load.
**Where:** `app/budget/transactions/page.tsx:67-83`
**Fix:** Default to current month with a month-nav header (like the budget overview page). Pass `month` / `year` as search params; filter the Supabase query with `.gte('transacted_at', startOfMonth).lte('transacted_at', endOfMonth)`. Add a MonthNav component above TransactionList. Large change but high payoff.

### [T-05] `TransactionReviewSheet` category picker is a plain `<select>`
**What:** Inline rows use the full `CategoryPicker` (emoji, color swatch, keyboard-friendly). The review sheet uses a plain `<select>`. Inconsistent UX.
**Where:** `app/components/budget/TransactionReviewSheet.tsx:101-117`
**Fix:** Replace the `<select>` with `CategoryPicker` (already imported elsewhere). Requires passing `onPick` callback and wiring `catId` state. Small.

---

## P3 — Code health

### [T-06] `is_pending` badge is "P" — not self-explanatory
**What:** Pending transactions show a small amber "P" badge. Most users won't know what it means.
**Where:** `TransactionList.tsx:434-437`
**Fix:** Change the badge text from `P` to `Pending`. One-line fix.

### [T-07] `any` cast on transaction query
**What:** `app/budget/transactions/page.tsx:69` and the category/trip queries use `as any` to suppress Supabase type errors. Type drift here causes silent bugs when schema changes.
**Where:** `app/budget/transactions/page.tsx`
**Fix:** Run `npx supabase gen types typescript > types/database.ts` and use the generated `Database` type on the Supabase client. Then type the query results properly. Medium — ripples across all budget pages.
