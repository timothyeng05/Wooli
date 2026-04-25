# Module: Budget

**Status:** Not yet built.
**Route:** `/budget`

## Purpose

Track income and expenses across accounts. Categorize transactions, view monthly summaries.

## Routes

| Route | Purpose |
|---|---|
| `/budget` | Monthly overview — income vs. expenses, category breakdown |
| `/budget/new` | Add a transaction |
| `/budget/transactions` | Full transaction list with filters |
| `/budget/transactions/[id]` | View / edit a transaction |
| `/budget/accounts` | Manage accounts |

## Schema

```sql
-- Accounts (checking, savings, cash, etc.)
create table public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  type       text not null,   -- 'checking' | 'savings' | 'cash' | 'investment'
  is_active  boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Categories
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  color      text,            -- hex color for UI
  is_income  boolean default false not null,
  created_at timestamptz default now() not null
);

-- Transactions
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  account_id  uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  amount      numeric(12, 2) not null,  -- positive = income, negative = expense
  description text,
  transacted_at timestamptz not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
```

**RLS:** Enable on all three tables, policy: `user_id = auth.uid()` for all operations.

## Field Notes

- `amount` — positive for income, negative for expense (simplifies summing)
- `transacted_at` — the real transaction date, not when it was entered
- `account_id` / `category_id` — nullable (set null on delete so transactions aren't lost)
- `type` on accounts — constrained to known values; enforce at app level or add a check constraint

## Components

```
src/components/budget/
  TransactionRow.tsx        ← single transaction in a list
  TransactionForm.tsx       ← create/edit form
  CategoryBadge.tsx         ← colored pill showing category
  MonthSummary.tsx          ← income / expense / net for a month
  AccountSelect.tsx         ← dropdown for picking account
```

## Dashboard Widget

Current month: total spent vs. a target (if set), or just spend-to-date.
Data source: sum of `transactions.amount` where `transacted_at` is this month.

## Build Order

1. Migrations (accounts, categories, transactions)
2. Seed default categories
3. `/budget/new` — transaction form (account + category dropdowns)
4. `/budget/transactions` — list view
5. `/budget` — monthly summary
6. `/budget/accounts` — account management
7. Dashboard widget
