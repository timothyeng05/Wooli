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

## Key notes

- `amount` positive = income, negative = expense.
- `is_transfer = true` excludes from income/expense totals — always filter this out in summaries.
- `is_hidden = true` also excludes from totals, but keeps the row's own category and labelling intact.
- Monthly overview groups by `category.parent_id` (top-level categories), respecting `budget_level`.
- Inline category edit in `TransactionList` triggers Supabase update directly — no API route needed.
