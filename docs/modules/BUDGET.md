# Module: Budget

**Status:** Active — fully built.
**Route:** `/budget`
**Layout:** `app/budget/layout.tsx` wraps all budget routes with `BudgetSidebar`.

## Purpose

Track income and expenses across bank accounts. Syncs transactions via Plaid, supports manual entry and CSV import, categorizes with AI, and tracks net worth over time.

## Routes

| Route | File | Notes |
|---|---|---|
| `/budget` | `app/budget/page.tsx` | Monthly overview — spending by category, income vs. expenses |
| `/budget/transactions` | `app/budget/transactions/page.tsx` | Full transaction list with search and filters |
| `/budget/new` | `app/budget/new/page.tsx` | Manually add a transaction |
| `/budget/[id]` | `app/budget/[id]/page.tsx` | Edit a transaction |
| `/budget/accounts` | `app/budget/accounts/page.tsx` | View accounts, connect Plaid, see balance history |
| `/budget/categories` | `app/budget/categories/page.tsx` | Manage category tree (parent + sub-categories) |
| `/budget/networth` | `app/budget/networth/page.tsx` | Net worth chart over time |
| `/budget/import` | `app/budget/import/page.tsx` | CSV import (Monarch, Copilot, generic) |
| `/budget/recurring` | `app/budget/recurring/page.tsx` | Recurring transaction rules |
| `/budget/recurring/new` | `app/budget/recurring/new/page.tsx` | Create recurring rule |
| `/budget/recurring/[id]` | `app/budget/recurring/[id]/page.tsx` | Edit recurring rule |

## API Routes

| Route | Purpose |
|---|---|
| `POST /api/plaid/link-token` | Create Plaid Link token for account connection |
| `POST /api/plaid/exchange-token` | Exchange public token after Plaid Link |
| `POST /api/plaid/sync-transactions` | Pull new transactions from Plaid |
| `POST /api/plaid/refresh-balances` | Update account balances from Plaid |
| `POST /api/budget/recategorize` | AI re-categorize selected transactions via Groq |
| `POST /api/budget/import-csv` | Parse and import uploaded CSV |
| `POST /api/budget/import-balances` | Import account balances from CSV |
| `POST /api/budget/generate-recurring` | Generate transactions from recurring rules |
| `POST /api/budget/sync-categories` | Sync category structure |
| `GET/POST /api/cron/sync` | Scheduled Plaid sync (runs via cron) |

## Components (`app/components/budget/`)

| File | Purpose |
|---|---|
| `BudgetSidebar.tsx` | Sticky left nav for all budget sub-pages |
| `TransactionList.tsx` | Full transaction table with inline category editing |
| `TransactionForm.tsx` | Create/edit form for manual transactions |
| `CategoryManager.tsx` | Category tree editor (3 sections: Expense, Income, Transfer) |
| `AccountsView.tsx` | Account list with balances and Plaid sync status |
| `AccountsPageClient.tsx` | Client-side accounts page with balance history chart |
| `NetWorthChart.tsx` | Net worth over time chart |
| `DashboardSpendingChart.tsx` | Monthly spend by category (used on dashboard) |
| `DashboardNetWorthChart.tsx` | Net worth mini-chart (used on dashboard) |
| `MonthNav.tsx` | Prev/next month navigation |
| `PlaidLinkButton.tsx` | Opens Plaid Link modal |
| `SyncTransactionsButton.tsx` | Triggers Plaid sync |
| `RecategorizeButton.tsx` | AI bulk re-categorize button |
| `RecurringList.tsx` | List of recurring transaction rules |
| `RecurringForm.tsx` | Create/edit recurring rule form |
| `CsvImportClient.tsx` | CSV drag-drop upload and column mapping UI |
| `catEmoji.ts` | `getCatEmoji(name, icon?)` helper + `CAT_EMOJI` name→emoji map |

## Lib (`lib/budget/`)

| File | Exports |
|---|---|
| `account-utils.ts` | `Account` type, `AccountType` enum, `isAssetType()`, `netWorth()`, `ACCOUNT_TYPES`, `TYPE_LABEL`, `OWNERS` |
| `plaid-client.ts` | `plaidClient` — configured Plaid API client singleton |
| `groq-categorize.ts` | `categorizeWithGroq()`, `buildSelectableCategories()`, `FewShotExample` type |

## Schema (key tables)

```sql
-- categories: tree of income/expense/transfer categories
categories (id, user_id, name, color, parent_id, is_income, is_transfer,
            sort_order, keywords, icon)

-- transactions: every spend/income event
transactions (id, user_id, account_id, category_id, amount, description,
              merchant_name, transacted_at, is_transfer, plaid_transaction_id,
              pending, iso_currency_code)

-- accounts: bank/investment accounts (manual + Plaid-linked)
accounts (id, user_id, name, type, subtype, balance, is_active, owner,
          plaid_access_token, plaid_item_id, plaid_account_id)

-- net_worth_snapshots: daily snapshot for charting
net_worth_snapshots (id, user_id, date, total_assets, total_liabilities, net_worth)

-- account_balance_history: per-account balance over time
account_balance_history (id, user_id, account_id, date, balance)
```

## Key Field Notes

- `amount` — positive = income, negative = expense. Sum directly.
- `is_transfer = true` — excluded from income/expense calculations (credit card payments, transfers between accounts).
- `categories.parent_id` — null = top-level parent, non-null = sub-category.
- `categories.is_transfer = true` — assigning such a category auto-marks the transaction as `is_transfer`.
- `categories.keywords` — comma-separated hints for AI auto-categorization.
- `categories.icon` — emoji override; falls back to `CAT_EMOJI` name map.
- Plaid transactions use `plaid_transaction_id` as dedup key.

## Migrations

`008_budget_module.sql`, `014_accounts.sql`, `017_net_worth_history.sql`, `018_add_owner.sql`, `019_transaction_account_link.sql`, `021_account_balance_history.sql`, `022_account_balance_history_v2.sql`, `023_category_icon_and_transfer.sql`
