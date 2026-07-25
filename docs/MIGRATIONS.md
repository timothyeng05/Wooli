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

## Pending

- `mood_entries` table (next: build mood module)
- `accounts`, `transactions`, `categories` (budget module)
- `calendar_events`, `journal_entries` (calendar module)
