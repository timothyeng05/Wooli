# Budget — Cash Flow

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/cashflow` | `app/budget/cashflow/page.tsx` | Cash flow analysis — income vs expenses over time |

## Components

| File | Purpose |
|------|---------|
| `CashFlowClient.tsx` | Full cash flow page — bar/line charts by month, per-owner breakdown, category drilldown. ~816 lines. |

## Schema (relevant tables)

```sql
transactions (id, user_id, account_id, category_id, amount, description,
              merchant_name, transacted_at, is_transfer, owner)

categories (id, name, color, is_income, is_transfer, parent_id)
```

## Key notes

- Queries transactions directly — no separate cashflow table.
- Always filter `is_transfer = false` to exclude CC payments and inter-account transfers.
- `is_reimbursement` rows must also subtract from expense totals here — don't let Cash Flow disagree with Dashboard/Targets/Transactions.
- `owner` field enables per-person breakdown in multi-member households.
- The `CashFlowTransaction` interface is defined in `app/budget/cashflow/page.tsx` (the server page, not the client component) — it's the shape passed as props.
- No API routes — all data fetched server-side in the page component.
