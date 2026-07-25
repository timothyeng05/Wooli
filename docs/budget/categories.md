# Budget — Categories

**The category tree editor lives at `/budget/settings/categories`, not `/budget/categories`.**
`app/budget/categories/page.tsx` is now a redirect stub to that route (same pattern as
the Cash Flow / `/budget/cashflow` redirect — don't "fix" it back).

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/settings/categories` | `app/budget/settings/categories/page.tsx` | Manage category tree — inside the Settings hub, see `docs/budget/settings.md` |
| `/budget/categories` | `app/budget/categories/page.tsx` | Redirect stub → `/budget/settings/categories` |
| `/budget/categories/[id]` | `app/budget/categories/[id]/page.tsx` | Category detail — transactions for this category (unchanged, still at this path) |

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
