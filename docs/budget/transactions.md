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
| `RecategorizeButton.tsx` | Triggers AI bulk re-categorization via Groq |
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
              merchant_name, transacted_at, is_transfer, plaid_transaction_id,
              pending, iso_currency_code)

categories (id, user_id, name, color, parent_id, is_income, is_transfer,
            sort_order, keywords, icon, budget_level)
```

## Key notes

- `amount` positive = income, negative = expense.
- `is_transfer = true` excludes from income/expense totals — always filter this out in summaries.
- Monthly overview groups by `category.parent_id` (top-level categories), respecting `budget_level`.
- Inline category edit in `TransactionList` triggers Supabase update directly — no API route needed.
