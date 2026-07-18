# Transactions — Improvement Backlog

_Generated 2026-06-04, re-verified against code 2026-07-18. Pick up from here; check off items as they land._

## Done ✅

- **Uncategorized filter** — added `__uncategorized__` sentinel to FilterPanel + filter logic in TransactionList (both chip display and filter matching)
- **Summary bar always visible** — removed the "only show when active filters" gate; bar now shows count + totals for the current view at all times
- **Bulk actions scroll padding** — added `pb-24 md:pb-16` to list wrapper when bulk bar is visible so last rows aren't obscured
- **T-01** — ReviewSheet now has editable description + merchant fields; category replaced with CategoryPicker
- **T-02** — Date range filter added to FilterPanel + TransactionList (chips + filter logic)
- **T-03** — Recurring generation moved to `/api/cron/sync`; transactions page no longer writes on load. (`/api/budget/generate-recurring` is a dead route with zero callers — delete it.)
- **T-04** — Transactions page is month-scoped with MonthNav + `year`/`month` search params. Remnant: `CashFlowClient.tsx` yearly view still lazily fetches all transactions client-side — tolerable for one user, revisit only if slow.
- **T-05** — ReviewSheet category picker replaced with CategoryPicker component
- **T-06** — Pending badge changed from "P" to "Pending"

---

## P3 — Code health

### [T-07] `any` cast on transaction query
**What:** `app/budget/transactions/page.tsx` and the category/trip queries use `as any` to suppress Supabase type errors (26 casts across 12 files under `app/budget`). Type drift here causes silent bugs when schema changes.
**Where:** `app/budget/**`
**Fix:** `npx supabase gen types typescript --project-id <ref> > lib/database.types.ts`, add the `Database` generic to the clients in `lib/supabase-server.ts` / `lib/supabase-client.ts`, then remove casts file-by-file. Medium — ripples across all budget pages.

---

## Plaid era (added 2026-07-18)

Plaid transaction sync is now the source of truth (Monarch CSV retired). Shipped alongside:
per-institution error capture (migration 039), pending→posted in-place updates, a
first-sync dedup guard that merges Plaid backfill into CSV history (`lib/budget/csv-dedup.ts`),
update-mode Link reconnect, and a connection-status strip on the accounts page.
