# Budget — Goals, Targets & Forecast

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/goals` | `app/budget/goals/page.tsx` | Savings goals linked to accounts |
| `/budget/targets` | `app/budget/targets/page.tsx` | Monthly spend targets per category |
| `/budget/forecast` | `app/budget/forecast/page.tsx` | Net worth / retirement projection |

## Components

| File | Purpose |
|------|---------|
| `GoalsPageClient.tsx` | Goals CRUD — create/edit/delete savings goals, link to accounts, track progress. Exports `Goal` type. |
| `BudgetTargetsClient.tsx` | Monthly category budget targets — set target_amount per category per month |
| `ForecastClient.tsx` | Retirement/net worth forecast — income streams, growth rates, projection chart. ~870 lines. |

## Schema (relevant tables)

```sql
-- Savings goals
budget_goals (id, user_id, name, icon, color, target_amount, target_date,
              current_amount, linked_account_ids, notes, is_active, sort_order)

-- Monthly spend targets (used by Targets page)
budgets (id, user_id, category_id, month, target_amount;
         unique on user_id + category_id + month)

-- Forecast parameters
forecast_settings (user_id PK, expense_monthly, expense_growth_rate,
                   investment_growth_rate, updated_at)

-- Accounts (Goals links to these for current_amount calculation)
accounts (id, user_id, name, type, subtype, balance, is_active, owner,
          plaid_access_token, plaid_item_id, plaid_account_id)
```

## Key notes

- `GoalsPageClient` imports `UnifiedAccount` from `AccountsPageClient.tsx` — don't change that type's shape without updating Goals too.
- `ForecastClient` also imports `Goal` from `GoalsPageClient` — three-way dependency: Forecast → Goals → Accounts.
- `budgets` table uses `month` as a `date` column (first day of the month, e.g. `2026-06-01`).
- `categories.budget_level` controls whether Targets shows the parent row or each sub-category row.
- `forecast_settings` is a single row per user (user_id is PK) — upsert, never insert.
- `ForecastClient` reads recent transactions to estimate `expense_monthly` baseline if no settings exist.
- Targets' `actuals` (in `app/budget/targets/page.tsx`) are net of any `is_reimbursement` transactions — an expense category's actual can be negative (net gain). `BudgetTargetsClient`'s `displayActual` only `Math.abs()`s income categories now, not expense ones.
