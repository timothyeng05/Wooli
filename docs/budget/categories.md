# Budget — Categories

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/categories` | `app/budget/categories/page.tsx` | Manage category tree |
| `/budget/categories/[id]` | `app/budget/categories/[id]/page.tsx` | Category detail — transactions for this category |

## Components

| File | Purpose |
|------|---------|
| `CategoryManager.tsx` | Category tree editor — 3 sections (Expense, Income, Transfer). CRUD for parents and sub-categories. |
| `CategoryPicker.tsx` | Inline dropdown selector — used in TransactionList rows and TransactionForm |
| `CategoryDetailClient.tsx` | Transactions scoped to one category with month nav |
| `catEmoji.ts` | `getCatEmoji(name, icon?)` + `CAT_EMOJI` name→emoji map |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/budget/sync-categories` | Sync default category structure |

## Schema

```sql
categories (id, user_id, name, color, parent_id, is_income, is_transfer,
            sort_order, keywords, icon, budget_level)
```

## Key notes

- `parent_id = null` → top-level parent category.
- `is_income = true` → income category (shown in Income section).
- `is_transfer = true` → assigning this category auto-marks the transaction as `is_transfer`, excluding it from income/expense totals.
- `keywords` — comma-separated strings used by Groq to auto-assign categories.
- `icon` — emoji override; falls back to `CAT_EMOJI[name]` in `catEmoji.ts`.
- `budget_level` — `'parent'` (target set on group) or `'sub'` (target set per sub-category); used by Targets page.
- `CategoryPicker` is shared across Transactions, Forms, and Recurring — changing its props is a wide blast radius.
