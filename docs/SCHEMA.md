# Database Schema

## Conventions (apply to every table)

- `id` — `uuid` primary key, default `gen_random_uuid()`
- `user_id` — `uuid references auth.users(id) on delete cascade`, not null
- `created_at` — `timestamptz` default `now()`, not null
- `updated_at` — `timestamptz` default `now()`, not null, auto-updated via trigger
- RLS enabled on every table
- RLS policies: users can only select/insert/update/delete their own rows (`user_id = auth.uid()`)

## Auth Layer

`auth.users` — managed by Supabase. Never written to directly from app code.

## public.profiles

1:1 extension of `auth.users`. Auto-created on signup via DB trigger.

```sql
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  username            text,
  avatar_url          text,
  timezone            text,
  onboarding_complete boolean default false,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);
```

**Triggers on profiles:**
- `handle_new_user()` — fires `after insert on auth.users`, creates profiles row
- `handle_updated_at()` — fires `before update` on profiles, sets `updated_at = now()`

**RLS policies on profiles:**
- `select`: `id = auth.uid()`
- `update`: `id = auth.uid()`
- No insert/delete from app — insert handled by trigger only

## Module Tables

Each module owns its tables. See `docs/modules/` for per-module schemas.

| Module | Tables |
|---|---|
| budget | `accounts`, `synced_accounts`, `bank_connections`, `transactions`, `categories`, `budgets`, `budget_goals`, `recurring_transactions`, `merchant_memory`, `institution_logos`, `account_holdings`, `account_balance_history`, `net_worth_history` |
| trips | `trips`, `trip_days`, `trip_hotels` |
| lists | `lists`, `list_items` |
| period | `period_entries` |
| social | `friendships`, `household_members` |
| shared | `profiles` |

**Orphaned — safe to drop.** `mood_entries` and `weekly_summaries` still exist but no code reads them; the mood module and `/api/weekly-summary` are both gone. Both are empty.

**Dropped in migration 054:** `list_shares`, `categorization_rules`, `reward_redemptions`, `template_benefits`, `account_balance_snapshots`, `transactions_backup_20260805`. The cards module tables (`cards`, `card_rewards`) went earlier with the module.

## Naming Conventions

- Table names: `snake_case`, plural nouns
- Column names: `snake_case`
- Foreign keys: `{referenced_table_singular}_id` (e.g. `account_id`, `card_id`)
- Boolean columns: prefix with `is_` or `has_` (e.g. `is_active`, `has_annual_fee`)
- Enum-like text columns: document valid values in module schema doc
