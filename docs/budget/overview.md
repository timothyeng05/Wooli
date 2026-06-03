# Budget Module — Overview

This file covers shared schema, conventions, and lib. For feature-specific docs see the sub-feature files in this directory.

## Sub-feature docs

| Feature | Doc |
|---------|-----|
| Transactions & monthly overview | `docs/budget/transactions.md` |
| Accounts & Plaid sync | `docs/budget/accounts.md` |
| Categories | `docs/budget/categories.md` |
| Recurring rules | `docs/budget/recurring.md` |
| CSV import | `docs/budget/import.md` |
| Cash flow analysis | `docs/budget/cashflow.md` |
| Goals, targets & forecast | `docs/budget/goals-forecast.md` |

## Schema

```sql
-- transactions: every spend/income event
transactions (id, user_id, account_id, category_id, amount, description,
              merchant_name, transacted_at, is_transfer, plaid_transaction_id,
              pending, iso_currency_code)

-- accounts: bank/investment accounts (manual + Plaid-linked)
accounts (id, user_id, name, type, subtype, balance, is_active, owner,
          plaid_access_token, plaid_item_id, plaid_account_id)

-- categories: tree of income/expense/transfer categories
categories (id, user_id, name, color, parent_id, is_income, is_transfer,
            sort_order, keywords, icon, budget_level)

-- budgets: monthly spend targets per category
budgets (id, user_id, category_id, month, target_amount; unique on user_id+category_id+month)

-- budget_goals: savings goals linked to accounts
budget_goals (id, user_id, name, icon, color, target_amount, target_date,
              current_amount, linked_account_ids, notes, is_active, sort_order)

-- forecast_settings: per-user forecast parameters
forecast_settings (user_id PK, expense_monthly, expense_growth_rate,
                   investment_growth_rate, updated_at)

-- net_worth_snapshots: daily snapshot for charting
net_worth_snapshots (id, user_id, date, total_assets, total_liabilities, net_worth)

-- account_balance_history: per-account balance over time
account_balance_history (id, user_id, account_id, date, balance)

-- recurring_transactions: recurring rule definitions
recurring_transactions (id, user_id, description, merchant, amount, frequency,
                        day_of_month, next_date, is_active, category_id)
```

## Key field conventions

- `amount` — positive = income, negative = expense. Sum directly; no sign flip needed.
- `is_transfer = true` — excluded from income/expense calculations (CC payments, transfers).
- `categories.parent_id` — null = top-level parent; non-null = sub-category.
- `categories.is_transfer = true` — assigning this category auto-marks transaction as `is_transfer`.
- `categories.keywords` — comma-separated hints for AI auto-categorization.
- `categories.icon` — emoji override; falls back to `CAT_EMOJI` name map in `catEmoji.ts`.
- `categories.budget_level` — `'parent'` (budget whole group) or `'sub'` (budget each sub-category).
- `plaid_transaction_id` — dedup key for Plaid-synced transactions.

## Lib files

| File | Key exports |
|------|-------------|
| `lib/budget/account-utils.ts` | `Account`, `AccountType`, `isAssetType()`, `netWorth()`, `ACCOUNT_TYPES`, `TYPE_LABEL`, `OWNERS` |
| `lib/budget/plaid-client.ts` | `plaidClient` singleton |
| `lib/budget/groq-categorize.ts` | `categorizeWithGroq()`, `buildSelectableCategories()`, `FewShotExample` |
| `lib/budget/format-utils.ts` | Formatting helpers |

## Shared infrastructure (read-only)

- `lib/supabase-client.ts` — use in client components
- `lib/supabase-server.ts` — use in server components; never mix
- `lib/groq.ts` — Groq AI SDK singleton
- `middleware.ts` — auth protection already covers `/budget`
- `app/layout.tsx`, `app/components/Nav.tsx` — top-level shell

## Migrations

`008_budget_module.sql`, `014_accounts.sql`, `017_net_worth_history.sql`, `018_add_owner.sql`, `019_transaction_account_link.sql`, `021_account_balance_history.sql`, `022_account_balance_history_v2.sql`, `023_category_icon_and_transfer.sql`, `024_budgets.sql`, `026_budget_goals.sql`, `027_forecast.sql`, `029_forecast_ages.sql`, `030_forecast_tax_rate.sql`
