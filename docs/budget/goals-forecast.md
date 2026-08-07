# Budget — Goals & Targets

_Forecast (net worth / retirement projection) was removed 2026-08 — see `docs/MIGRATIONS.md` for the table drop. This doc covered all three together; Forecast's sections are gone, not just hidden._

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/goals` | `app/budget/goals/page.tsx` | Savings goals linked to accounts |
| `/budget/targets` | `app/budget/targets/page.tsx` | Monthly spend targets per category |

## Components

| File | Purpose |
|------|---------|
| `GoalsPageClient.tsx` | Goals CRUD — create/edit/delete savings goals, link to accounts, track progress. Exports `Goal` type. |
| `BudgetTargetsClient.tsx` | Monthly category budget targets — set target_amount per category per month |

## Schema (relevant tables)

```sql
-- Savings goals
budget_goals (id, user_id, name, icon, color, target_amount, target_date,
              current_amount, linked_account_ids, notes, is_active, sort_order)

-- Monthly spend targets (used by Targets page)
budgets (id, user_id, category_id, month, target_amount;
         unique on user_id + category_id + month)

-- Manual accounts (Goals links to these plus synced_accounts for current_amount calculation)
accounts (id, user_id, name, type, subtype, balance, is_active, owner)
```

## Key notes

- `GoalsPageClient` imports `UnifiedAccount` from `AccountsPageClient.tsx` — don't change that type's shape without updating Goals too.
- `budgets` table uses `month` as a `date` column (first day of the month, e.g. `2026-06-01`).
- `categories.budget_level` controls whether Targets shows the parent row or each sub-category row.
- Targets' `actuals` (in `app/budget/targets/page.tsx`) sum expense magnitudes per category.
