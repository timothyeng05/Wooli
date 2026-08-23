# Migrations Log

Chronological log of all Supabase migrations run. Each entry includes what was run and why.
SQL is written as reference — actual execution was in Supabase SQL editor.

---

## 2026-04 — Initial Setup

### 01 — Wipe old tables
All previously existing tables dropped. Starting clean.

### 02 — Create profiles table

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

### 03 — Auto-create profile on signup trigger

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 04 — Auto-update updated_at trigger

```sql
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
```

### 05 — RLS on profiles

```sql
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());
```

---

### 06 — Benefit sync tables (cards module admin data)

```sql
-- Card templates (admin table, no user_id)
create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  issuer text,
  network text,
  annual_fee numeric(8, 2),
  created_at timestamptz default now() not null
);

-- Benefit categories
create table public.benefit_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  created_at timestamptz default now() not null
);

-- Benefits
create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category_id uuid references public.benefit_categories(id) on delete cascade,
  amount numeric(12, 2),
  amount_unit text,
  period_type text,
  period_frequency int,
  enrollment_required boolean default false,
  enrollment_notes text,
  description text,
  benefit_notes text,
  hard_expiration_date text,
  created_at timestamptz default now() not null
);

-- Card template benefits
create table public.template_benefits (
  id uuid primary key default gen_random_uuid(),
  card_template_id uuid references public.card_templates(id) on delete cascade not null,
  benefit_id uuid references public.benefits(id) on delete cascade not null,
  is_core_default boolean default true,
  created_at timestamptz default now() not null,
  unique(card_template_id, benefit_id)
);
```

**Why:** Support syncing credit card benefits from `public/data/benefits.xlsx`. These are global reference data (no user_id), seeded via `/api/sync-benefits` endpoint.

---

### 07 — Card benefits tracking (cards module feature)

```sql
create table public.card_benefits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  benefit_id uuid references public.benefits(id) on delete cascade not null,
  is_core boolean default false not null,
  usage_data jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(card_id, benefit_id)
);

alter table public.card_benefits enable row level security;

create policy "Users manage own card benefits"
  on public.card_benefits for all
  using (
    card_id in (
      select id from public.cards where user_id = auth.uid()
    )
  );

create trigger set_card_benefits_updated_at
  before update on public.card_benefits
  for each row execute procedure public.handle_updated_at();
```

**Why:** Track which template benefits are "core" to each user's card, plus quarterly/monthly/annual usage data. Allows users to toggle core/non-core status and see if core benefits cover the annual fee.

---

## 2026-07 — Plaid item health

### 039 — plaid_items health columns (`supabase/migrations/039_plaid_item_health.sql`)

```sql
alter table public.plaid_items add column if not exists status text not null default 'healthy'; -- healthy | error
alter table public.plaid_items add column if not exists error_code text;                        -- e.g. ITEM_LOGIN_REQUIRED
alter table public.plaid_items add column if not exists error_message text;
alter table public.plaid_items add column if not exists last_successful_sync_at timestamptz;
alter table public.plaid_items add column if not exists last_sync_attempt_at timestamptz;
```

**Why:** Plaid transaction sync is now the source of truth (Monarch CSV retired). Sync captures per-institution errors (e.g. ITEM_LOGIN_REQUIRED) instead of aborting the whole run, and the accounts page surfaces connection status with a Reconnect (update-mode Link) button.

---

## 2026-07-19 — Plaid account overrides

### 040 — plaid_accounts type_override + sort_order (`supabase/migrations/040_plaid_accounts_overrides.sql`)

```sql
alter table public.plaid_accounts add column if not exists type_override text
  check (type_override in ('cash', 'investment', 'credit', 'loan'));
alter table public.plaid_accounts add column if not exists sort_order integer not null default 0;
```

**Why:** Plaid's own `type`/`subtype` classification isn't always how the user wants an account grouped (e.g. a credit-type account they want under Investments) — `type_override` lets the app's own grouping win without fighting Plaid on every sync. `sort_order` backs manual drag-to-reorder within a group, mirroring the existing `accounts.sort_order` column manual accounts already had.

---

## 2026-07-25 — Review defaults

### 045 — transactions.needs_review defaults to unreviewed (`supabase/migrations/045_review_defaults.sql`)

```sql
alter table public.transactions alter column needs_review set default true;

update public.transactions
set needs_review = true
where needs_review = false
  and coalesce(categorization_source, '') <> 'user_confirmed';
```

**Why:** `needs_review` used to mean "the categorizer was unsure" and defaulted to `false`, so confidently auto-categorized transactions were silently treated as reviewed without a human ever verifying them. Now `needs_review` means "a human hasn't verified this yet": every transaction starts unreviewed and only an explicit user confirmation clears it. The backfill flips all existing non-`user_confirmed` rows to unreviewed so the queue reflects everything actually awaiting verification.

---

## 2026-08-04 — Replace Plaid with SimpleFin

### 047 — Plaid → SimpleFin rename (`supabase/migrations/047_simplefin_migration.sql`)

```sql
alter table public.plaid_items rename to bank_connections;
alter table public.bank_connections rename column access_token to access_url;
alter table public.bank_connections alter column access_url drop not null;
alter table public.bank_connections add column if not exists org_domain text;
alter table public.bank_connections drop column if exists cursor;
alter table public.bank_connections drop column if exists institution_id;

alter table public.plaid_accounts rename to synced_accounts;
alter table public.synced_accounts rename column account_id to provider_account_id;
alter table public.synced_accounts drop column if exists official_name;
alter table public.synced_accounts add column connection_id uuid references public.bank_connections(id);
-- (connection_id backfilled from the old item_id fk, then item_id dropped from both tables)

alter table public.transactions rename column plaid_transaction_id to provider_transaction_id;
alter table public.transactions rename column plaid_account_id to provider_account_id;

update public.bank_connections
  set access_url = null, status = 'error', error_code = 'NEEDS_RECONNECT'
  where access_url is not null;
```

**Why:** Full replacement of Plaid with SimpleFin for bank sync (personal-app cost/complexity tradeoff — SimpleFin needs no app-level API credentials and has a much simpler read-only protocol). Tables/columns renamed in place rather than recreated, to preserve history and RLS policies. SimpleFin's access tokens are fundamentally different from Plaid's (a Basic-Auth access URL vs. an opaque token) and it issues new account ids on reconnect, so the 4 existing Plaid-origin connections can't carry over — this migration freezes them (`access_url = null`, `status = 'error'`) so the accounts page immediately prompts reconnection, while their historical transactions keep their (renamed) ids and denormalized `account_name` for reporting continuity.

### 048 — synced_accounts org columns (`supabase/migrations/048_synced_accounts_org.sql`)

```sql
alter table public.synced_accounts add column if not exists org_name text;
alter table public.synced_accounts add column if not exists org_domain text;
```

**Why:** Discovered once a real SimpleFin setup token was used — a single token covers the user's whole bridge account, which can span multiple institutions in one `bank_connections` row (one token → Citibank + Chase + Schwab accounts all under one connection). Each account needs its own institution identity instead of inheriting one label from the connection.

### 049 — drop Forecast tables (`supabase/migrations/049_drop_forecast.sql`)

```sql
drop table if exists public.forecast_income_streams;
drop table if exists public.forecast_settings;
drop table if exists public.forecast_member_settings;
```

**Why:** Forecast (net worth / retirement projection) feature removed. `household_members` and `budget_goals` are shared with other features (Accounts owner labels, Goals) and were not touched.

### 055 — hide a transaction from totals (`supabase/migrations/055_transaction_hidden.sql`)

```sql
alter table public.transactions
  add column if not exists is_hidden boolean not null default false;

create index if not exists transactions_hidden_idx
  on public.transactions (user_id, transacted_at)
  where is_hidden;
```

**Why:** `is_transfer` was the only way to keep a row out of income/expense maths, but it also relabels the row as a transfer — wrong for a reimbursed work expense, a double-posted charge, or a one-off that would distort a category trend. Those are real expenses on a real account that simply shouldn't count toward spend. Monarch's semantics: a hidden transaction stays visible (dimmed) in the transaction list so it can be found and unhidden, and is excluded from every total. `not null default false` so reads treat it as a plain boolean rather than defending against null the way `is_transfer` has to. The index is partial on the hidden rows only — they're the rare case, so it stays small.

### 056 — re-flag auto-approved transactions for review (`supabase/migrations/056_reflag_auto_approved_for_review.sql`)

```sql
update public.transactions
set needs_review = true
where needs_review = false
  and coalesce(categorization_source, '') <> 'user_confirmed';
```

**Why:** Migration 045 set the rule — `needs_review` means "a human hasn't verified this yet" — but the categorization pipeline never followed it. `runDeterministicLayers` in `lib/budget/categorize/pipeline.ts` built every result from a `base` object carrying `needs_review: false`, so confident `merchant_memory`, `provider_mapping` and `similarity_match` hits were written already-reviewed and never appeared in the queue. Because merchant memory is seeded by user confirmations, a single early confirmation silently auto-approved every future transaction from that merchant. The pipeline is fixed (base now carries `needs_review: true`, with regression tests); this backfills the 90 rows written while it was wrong, reusing 045's exact predicate so genuinely user-confirmed rows are left alone.

### 057 — merge duplicate categories (`supabase/migrations/057_merge_duplicate_categories.sql`)

**Why:** On 2026-08-18 16:59:59–17:00:00 UTC, `/api/setup-budget` seeded its full 34-category default tree on top of an existing, already-customised tree, leaving 14 duplicated names. The `sort_order` fingerprint is conclusive — parents at 0..6 in `DEFAULT_CATEGORIES` order, children at `7 + parentIndex*10 + childIndex`, exactly that route's formula.

The likely trigger is `/api/reset-onboarding`, which deletes every category and clears `onboarding_completed_at`, after which onboarding re-seeds. Its only guard then was an email check for `woolitravel@gmail.com`, which does not match the app account; commit `8069fd6` later added the `NODE_ENV` gate that closes this off. That route's delete has no error handling, so a partial failure would pass silently — consistent with the originals surviving alongside the new set.

**Merge rule:** for each `(user, name, top-level-or-not)` group with more than one row, the **oldest** row wins; newer copies have their transactions, budgets, merchant memory and child categories repointed onto it, then are deleted. Most pairs sat under different parents (Lifestyle/Personal, General/Other, Household/Home, Earnings/Income) because the top-level categories had been renamed — same concept under a renamed vs default parent, so older-wins is still correct.

**Result:** 78 → 64 categories, 14 removed; 7 transactions, 0 budgets and 6 merchant-memory rows repointed, 12 children reparented. Transaction count unchanged at 146, with zero orphaned transactions, budgets, memory rows or child categories.

### 062 — split hide-account from hide-transactions (`supabase/migrations/062_split_hide_account_from_hide_transactions.sql`)

```sql
update public.synced_accounts
set exclude_from_reports = true
where is_hidden = true and coalesce(exclude_from_reports, false) = false;

alter table public.synced_accounts alter column exclude_from_reports set default false;
alter table public.accounts        alter column exclude_from_reports set default false;
```

**Why:** `synced_accounts.is_hidden` was doing two jobs — collapsing the account out of the accounts list AND excluding its transactions from the list, the review queue and every report. They are now independent toggles on the Accounts page. `exclude_from_reports` already existed on both account tables but was dead (no code read or wrote it); it now carries the second meaning, and is the only column the transaction filter reads. The backfill copies `is_hidden` into it so behaviour was unchanged at the moment of the split. Both columns were nullable with no default, so they are normalised to `false` and given a default — the app-side filters use `eq`, which would otherwise have to defend against null.

---

## Pending

- `mood_entries` table (next: build mood module)
- `accounts`, `transactions`, `categories` (budget module)
- `calendar_events`, `journal_entries` (calendar module)
