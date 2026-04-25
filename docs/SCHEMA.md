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
| mood | `mood_entries` |
| budget | `accounts`, `transactions`, `categories` |
| cards | `cards`, `card_rewards`, `reward_redemptions` |
| calendar | `calendar_events`, `journal_entries` |

> Tables not yet created — added here as each module is built.

## Naming Conventions

- Table names: `snake_case`, plural nouns
- Column names: `snake_case`
- Foreign keys: `{referenced_table_singular}_id` (e.g. `account_id`, `card_id`)
- Boolean columns: prefix with `is_` or `has_` (e.g. `is_active`, `has_annual_fee`)
- Enum-like text columns: document valid values in module schema doc
