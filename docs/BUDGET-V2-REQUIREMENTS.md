# Budget v2 — Requirements

_Written 2026-04-26. Inspired by Monarch Money, but no bank-API integration._

## Vision

A budget experience that feels like Monarch but works on manually-entered or CSV-imported transactions. The user should be able to:

- See the financial big picture (net worth, monthly cash flow) at a glance
- Trust the numbers without spending hours typing transactions
- Hit "I need to know X" answers in under 30 seconds (e.g. "How much did I spend on dining in March?")
- Plan against budgets, not just look at the past

What we're explicitly NOT building (yet):
- Bank API integration (Plaid, Teller, etc.)
- Investment portfolio tracking with security-level holdings
- Bill negotiation, credit score, debt-payoff coaches
- Sharing / household / partner accounts (deferred until friend system in Lists ships)

## Personas

**Primary: Tim** — power-user, has multiple credit cards (CSR), wants to see total picture across all his cards + a few bank accounts. Will spend 10 minutes a week categorizing.

**Secondary: Tim's sister** — coming from no system or scattered spreadsheets. Wants to know "where is my money going" without studying. Tolerates ~5 min/week of upkeep. Almost certainly will hate typing every transaction → CSV import is critical for her.

The product needs to work for the secondary persona to be worth scaling.

## Mental model

```
Accounts          ← where money lives (checking, savings, credit, investment, cash)
   │
   ├─ Balance     ← updated manually or by transaction history
   │
Transactions      ← money moving in/out of accounts
   │
   ├─ Category    ← what it was for
   ├─ Merchant    ← who you paid
   │
Budgets           ← monthly target per category
   │
Net worth         ← sum of all account balances at a point in time
```

What we already have: `transactions` table, `categories` table (with parent/child). Missing the account layer entirely.

## Schema additions

### New: `accounts` table
```sql
create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,                          -- "Chase Checking", "Apple Card"
  type          text not null check (type in ('checking', 'savings', 'credit', 'investment', 'cash', 'loan', 'other')),
  institution   text,                                   -- "Chase", "Apple"
  current_balance numeric(14, 2) default 0 not null,    -- always in user's primary currency for now
  is_active     boolean default true not null,
  is_asset      boolean default true not null,          -- true for checking/savings/etc, false for credit/loan
  notes         text,
  sort_order    int default 0,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);
```

### New: `account_balance_snapshots` table
For historical net-worth tracking.
```sql
create table public.account_balance_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  account_id    uuid references public.accounts(id) on delete cascade not null,
  balance       numeric(14, 2) not null,
  recorded_on   date not null,
  created_at    timestamptz default now() not null,
  unique(account_id, recorded_on)
);
```
Snapshot daily (or on each balance update). Powers the net-worth-over-time chart.

### New: `budgets` table
Monthly category targets.
```sql
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  category_id   uuid references public.categories(id) on delete cascade not null,
  month         date not null,                          -- first day of month, e.g. 2026-04-01
  target_amount numeric(12, 2) not null,
  notes         text,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,
  unique(user_id, category_id, month)
);
```

### Modify: `transactions`
Add columns:
```sql
alter table public.transactions
  add column account_id uuid references public.accounts(id) on delete set null,
  add column notes text,
  add column is_recurring boolean default false not null,
  add column recurring_id uuid;        -- self-reference for grouping a recurring series; null for one-off
```

### New: `recurring_transaction_templates` table
For "this happens every month" — generates suggestions, not auto-creates.
```sql
create table public.recurring_transaction_templates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  account_id    uuid references public.accounts(id) on delete set null,
  category_id   uuid references public.categories(id) on delete set null,
  amount        numeric(12, 2) not null,
  description   text,
  merchant      text,
  cadence       text not null check (cadence in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date    date not null,
  end_date      date,
  last_generated_on date,
  is_active     boolean default true not null,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);
```

## Feature priorities (build in this order)

### P0 — Foundation (no value alone, but everything else needs it)

**Phase 1: Accounts** *(this session, if tokens allow)*
- Migration creates `accounts` + `account_balance_snapshots` tables
- `/budget/accounts` page: list, add, edit, archive
- Each account row shows current balance, type, institution
- New transaction form gets an "Account" dropdown
- Backfill: existing transactions get null `account_id` (allowed)

**Phase 2: Transaction edit + delete** *(deferred from previous spec, still needed)*
- `/budget/[id]` edit page reusing TransactionForm
- Inline ✕ delete on transaction list

### P1 — High-value monthly user value

**Phase 3: CSV import**
- `/budget/import` page: upload a CSV (bank statement export), preview parsed rows, map columns to fields, bulk insert
- Auto-detect duplicates by `(date, amount, merchant)` hash
- Save column mapping per account so re-imports are 1-click
- This is THE feature for the secondary persona

**Phase 4: Cash flow chart**
- Bar chart on `/budget`: monthly income vs expenses for the past 6 months
- Sankey diagram (nice-to-have): income source → categories → savings/leftover
- Use a tiny chart lib (Recharts or just SVG primitives)

**Phase 5: Budgets (targets vs actuals)**
- New page `/budget/targets`: set monthly target per category
- Dashboard shows progress bar per category: spent / target, color-coded (green/yellow/red)
- Roll over unused budget? — defer that decision

### P2 — Power-user nice-to-haves

**Phase 6: Date range navigation**
- `/budget?month=2026-03` URL param
- Prev/next month chevrons in header
- Quick toggles: This month / Last month / This quarter / This year / Custom range

**Phase 7: Recurring transactions**
- "Make recurring" button on a transaction → creates a `recurring_transaction_templates` row
- Daily cron (Vercel cron job or just a daily check on dashboard load) generates suggested transactions
- User confirms each one before it lands; never auto-creates

**Phase 8: Net worth chart**
- Line chart of total assets minus liabilities over time
- Pulls from `account_balance_snapshots`
- "Update balances" button on `/budget/accounts` to record today's snapshot for all accounts

**Phase 9: Search + filters**
- Transaction list gets: search by merchant / description / amount range
- Filter by category, account, date range
- "Save this filter" → bookmarkable URL

### P3 — Future / maybe

- Split transactions (one charge → multiple categories)
- Tags (orthogonal to categories)
- Goals (savings, debt payoff)
- Bills tracking (subset of recurring)
- Multi-currency
- Sharing with partner / household — pairs with Lists' future friend system

## What "ambitious" means here

In Monarch terms, we're building toward a manual-entry version of:
- ✅ Cash flow + budgets + categories (Phases 1, 4, 5)
- ✅ Net worth tracking (Phases 1, 8)
- ✅ Recurring detection (Phase 7)
- ✅ Reports & search (Phases 6, 9)
- ❌ Bank sync (out of scope)
- ❌ Investments (out of scope; manual balance is enough)
- ❌ Bills, debt-payoff coach (out of scope)

That's a meaningful chunk of Monarch's UX, achievable in 8–10 build sessions.

## Phase 1 — what to build right now

Starting on this in the same session if tokens allow:

1. Apply migration `014_accounts.sql` (accounts + account_balance_snapshots tables, RLS, triggers)
2. Apply migration `015_transactions_account_id.sql` (add `account_id`, `notes`, `is_recurring`, `recurring_id` to transactions)
3. Build `/budget/accounts` page — list + add/edit/archive
4. Add "Account" dropdown to `TransactionForm.tsx`
5. Add an "Accounts" link to the Budget page header

What's intentionally NOT in Phase 1:
- Balance snapshots / net worth chart (later phase even though the table is added now)
- CSV import
- Recurring detection
- Anything visual on the dashboard

## Verification (Phase 1)

- `npm run build` clean
- `/budget/accounts` lets you add a "Chase Checking" with balance $5000, type=checking
- New transaction form dropdown shows the account; submitting saves the link
- Transaction list shows the account name on each row
- Existing transactions (which have null `account_id`) still display fine
- RLS: confirm via Supabase MCP that policies are present on the new tables
