# Budget — Transactions & Monthly Overview

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget` | `app/budget/page.tsx` | Monthly overview — spending by category, income vs expenses |
| `/budget/transactions` | `app/budget/transactions/page.tsx` | Full transaction list with search and filters |
| `/budget/new` | `app/budget/new/page.tsx` | Manually add a transaction |
| `/budget/[id]` | `app/budget/[id]/page.tsx` | Edit a transaction |

## Components

| File | Purpose |
|------|---------|
| `TransactionList.tsx` | Full transaction table with inline category editing, search, filter panel |
| `TransactionForm.tsx` | Create/edit form for manual transactions |
| `TransactionDetail.tsx` | Read view for a single transaction |
| `TransactionReviewSheet.tsx` | Slide-over sheet for quick review/edit |
| `FilterPanel.tsx` | Date range + category filter UI used by TransactionList |
| `MonthNav.tsx` | Prev/next month navigation (used on overview page) |
| `transaction-types.ts` | Shared TypeScript types for transactions |
| `CategoryPicker.tsx` | Inline category selector (used within transaction rows) |
| `catEmoji.ts` | `getCatEmoji(name, icon?)` + `CAT_EMOJI` name→emoji map |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/budget/recategorize` | AI re-categorize selected transactions via Groq |

## Schema (relevant tables)

```sql
transactions (id, user_id, account_id, category_id, amount, description,
              merchant_name, transacted_at, is_transfer, provider_transaction_id,
              provider_account_id, is_pending)

categories (id, user_id, name, color, parent_id, is_income, is_transfer,
            sort_order, keywords, icon, budget_level)
```

## Review model (`needs_review`)

- `needs_review` means **a human hasn't verified this transaction yet** — not "the AI was unsure".
- Every new transaction starts **unreviewed** (`needs_review = true`), transfers included, regardless of how confidently it was auto-categorized. The column defaults to `true` (migration `045`).
- Only an explicit user confirmation clears it: the review sheet, inline category pick, inline transfer toggle, and bulk category/transfer actions all set `needs_review = false` with `categorization_source = 'user_confirmed'`.
- Exceptions that start reviewed: manual adds (`TransactionForm`), CSV imports (curated from Monarch/Copilot), and recurring-rule-generated transactions.
- AI re-categorization (`/api/budget/recategorize`) does **not** change review state — it's not a human review.
- **Neither does an automatic categorization at sync time.** Every layer of the pipeline — `merchant_memory`, `provider_mapping`, `similarity_match`, `groq` — returns `needs_review: true`. Confidence decides whether a category is *prefilled*, never whether the user sees the row. Regression-tested in `lib/budget/categorize/__tests__/pipeline.test.ts`.
  - This was broken between roughly 2026-07-25 and 2026-08-22: `runDeterministicLayers` built its result from a `base` object carrying `needs_review: false`, so confident deterministic hits were written already-reviewed and never reached the queue. Because merchant memory is *seeded by user confirmations*, one early confirmation then silently auto-approved every later transaction from that merchant. Migration `056` re-flagged the 90 affected rows.
- The list shows a violet `Review` badge on any `needs_review` row.

### Review queue (Monarch-style)

- `TransactionList` has a **Review** toggle in the toolbar. It's a **global, all-time** queue (`fetchUnreviewed`) — not scoped to the month the page loaded — so it can be cleared to zero.
- In review mode: each row gets a one-click ✓ ("accept as-is" → marks reviewed + `user_confirmed`), a **Mark all N reviewed** button (respects any active search/filter), and row-click still opens the review sheet. Standard filters (owner, account, category) narrow the queue.
- Any reviewed-state change dispatches a `budget:review-changed` window event (`REVIEW_CHANGED_EVENT`). `BudgetSidebar` and `BudgetMobileDrawer` listen for it (and refetch on navigation) to keep the **unreviewed-count badge** on the Transactions nav item current.

## Hidden transactions (`is_hidden`)

- `is_hidden = true` keeps a row **out of every total** without deleting it or mislabelling it a transfer — for a reimbursed expense, a duplicate the bank posted twice, or a one-off that would distort a category trend. Added in migration `055`.
- The row **stays visible in the transaction list**, dimmed, with a grey `Hidden` badge. Tapping the badge unhides it in place; there's also a **Hide from totals** toggle in the review sheet and a **Hide/Unhide** bulk action. The bulk button shows *Unhide* only when every selected row is already hidden.
- **Excluded from:** the list's summary bar and day subtotals, dashboard (spend window + recent activity), cash flow, spend targets, household map, and category detail. Report queries filter with `.eq('is_hidden', false)`; the list filters client-side since it still renders the rows.
- The summary bar reports hidden rows separately (`N hidden, not counted`) so the totals and the row count never look like they disagree.
- **Excluded from the review queue too** — hiding a row is already a decision about it. It is dropped by the queue's `is_hidden` filter rather than by setting `needs_review = false`, so unhiding restores it with its original review state. All four counts of that queue (`fetchUnreviewed`, `refreshUnreviewedCount`, `BudgetSidebar`, `BudgetMobileDrawer`) apply the same filter — they must agree or the nav badge reads a different number than the queue shows.
- `FilterPanel` has a **Show hidden transactions** toggle (on by default). Turning it off drops hidden rows from the list entirely and shows a `Hidden excluded` chip.

## Hidden accounts (`synced_accounts.is_hidden`)

Hiding an account on the Accounts page also hides **its transactions** — unlike `transactions.is_hidden`, these don't linger dimmed in the list, they don't appear at all.

- Kept separate from `transactions.is_hidden` on purpose: that flag is a per-transaction decision, this is a property of the account. Unhiding an account therefore restores exactly the rows that were visible before, leaving any individually hidden ones hidden.
- Transactions link to a synced account by the denormalized text `transactions.provider_account_id`, **not** a foreign key, so the exclusion is a value filter (`lib/budget/hidden-accounts.ts`).
- **Always apply it via `visibleTransactionsFilter(supabase, userId)`**, which resolves the hidden accounts once and returns a wrapper for each query. Don't hand-roll the filter:
  - `NULL NOT IN (…)` is `NULL` in SQL, not true, so a bare `not.in` silently drops every **manually added** transaction (those have no `provider_account_id`). The `provider_account_id.is.null` arm exists solely to prevent that — verified against live data: the correct filter keeps the manual row, the naive one loses it.
  - PostgREST rejects an empty `in.()` list, so "no accounts hidden" must mean "apply no filter at all". The wrapper handles that; a raw filter string doesn't.
- `buildHiddenAccountFilter` quotes each id, so a comma inside a provider id can't split the list. Unit-tested in `lib/budget/__tests__/hidden-accounts.test.ts`.
- **Applied in:** transactions list, review queue and all its badge counts (via `countUnreviewed`), dashboard (spend window + recent + review feed), monthly overview, cash flow (incl. the lazy yearly fetch), targets, household map, category detail.

### Review-queue count

`lib/budget/review-queue.ts` exports `countUnreviewed`, the single source for the violet nav badge. Four places used to ask this question independently and every new exclusion had to be mirrored by hand; when they disagree the badge shows a number the queue can't produce, and clearing the queue never zeroes the badge. Add exclusions there, not at the call sites.

Note: `accounts.exclude_from_reports` and `synced_accounts.exclude_from_reports` exist in the database but are **unused** — no code reads or writes them.

## Key notes

- `amount` positive = income, negative = expense.
- `is_transfer = true` excludes from income/expense totals — always filter this out in summaries.
- `is_hidden = true` also excludes from totals, but keeps the row's own category and labelling intact.
- Monthly overview groups by `category.parent_id` (top-level categories), respecting `budget_level`.
- Inline category edit in `TransactionList` triggers Supabase update directly — no API route needed.
