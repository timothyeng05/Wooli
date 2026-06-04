-- Layered deterministic categorization pipeline.
-- Adds provenance columns to transactions, a user-rules table, a merchant-memory
-- table (seeded from user-confirmed edits via a trigger), and a pg_trgm-backed
-- similarity RPC. Groq becomes a last-resort fallback rather than the entry point.

create extension if not exists pg_trgm;

-- ── transactions: categorization provenance ──────────────────────────────────
alter table public.transactions add column if not exists normalized_merchant text;
alter table public.transactions add column if not exists categorization_source text;
alter table public.transactions add column if not exists categorization_confidence numeric(4, 3);
alter table public.transactions add column if not exists needs_review boolean not null default false;
alter table public.transactions add column if not exists provider_category text;
alter table public.transactions add column if not exists groq_called boolean not null default false;

create index if not exists transactions_normalized_merchant_trgm
  on public.transactions using gin (normalized_merchant gin_trgm_ops);

create index if not exists transactions_needs_review_idx
  on public.transactions (user_id) where needs_review;

-- ── categorization_rules ─────────────────────────────────────────────────────
create table if not exists public.categorization_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text,
  priority      int default 0 not null,
  match_normalized_merchant text,
  match_raw_merchant        text,
  match_regex               text,
  match_amount_min          numeric(12, 2),
  match_amount_max          numeric(12, 2),
  match_account_name        text,
  match_mcc                 text,
  match_notes               text,
  category_id   uuid references public.categories(id) on delete cascade,
  is_transfer   boolean default false not null,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

create index if not exists categorization_rules_user_idx
  on public.categorization_rules (user_id, priority, created_at);

alter table public.categorization_rules enable row level security;

drop policy if exists "Users manage own rules" on public.categorization_rules;
create policy "Users manage own rules"
  on public.categorization_rules for all
  using (user_id = auth.uid());

drop trigger if exists set_categorization_rules_updated_at on public.categorization_rules;
create trigger set_categorization_rules_updated_at
  before update on public.categorization_rules
  for each row execute procedure public.handle_updated_at();

-- ── merchant_memory ──────────────────────────────────────────────────────────
create table if not exists public.merchant_memory (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  normalized_merchant text not null,
  account_name        text default '' not null,
  category_id         uuid references public.categories(id) on delete cascade,
  is_transfer         boolean default false not null,
  confidence          numeric(4, 3) default 1.0 not null,
  source              text default 'user_confirmed' not null,
  confirm_count       int default 1 not null,
  updated_at          timestamptz default now() not null,
  unique (user_id, normalized_merchant, account_name)
);

create index if not exists merchant_memory_lookup_idx
  on public.merchant_memory (user_id, normalized_merchant);

alter table public.merchant_memory enable row level security;

drop policy if exists "Users manage own merchant memory" on public.merchant_memory;
create policy "Users manage own merchant memory"
  on public.merchant_memory for all
  using (user_id = auth.uid());

-- ── trigger: user-confirmed edits seed merchant_memory ───────────────────────
-- Only fires for genuine user confirmations (categorization_source = 'user_confirmed'),
-- so pipeline-written categories (groq/similarity/etc.) never pollute memory.
create or replace function public.record_merchant_memory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.categorization_source = 'user_confirmed'
     and new.normalized_merchant is not null
     and new.normalized_merchant <> ''
     and (new.category_id is not null or new.is_transfer) then
    insert into public.merchant_memory
      (user_id, normalized_merchant, account_name, category_id, is_transfer, confidence, source, confirm_count, updated_at)
    values
      (new.user_id, new.normalized_merchant, coalesce(new.account_name, ''),
       new.category_id, coalesce(new.is_transfer, false), 1.0, 'user_confirmed', 1, now())
    on conflict (user_id, normalized_merchant, account_name)
    do update set
      category_id   = excluded.category_id,
      is_transfer   = excluded.is_transfer,
      confidence    = 1.0,
      confirm_count = public.merchant_memory.confirm_count + 1,
      updated_at    = now();
  end if;
  return new;
end;
$$;

drop trigger if exists record_merchant_memory_trg on public.transactions;
create trigger record_merchant_memory_trg
  after insert or update of category_id, is_transfer, categorization_source
  on public.transactions
  for each row execute procedure public.record_merchant_memory();

-- ── RPC: lexical-similarity category lookup (pg_trgm) ─────────────────────────
-- Returns the category of the most similar previously-categorized transaction,
-- if its trigram similarity clears the threshold.
create or replace function public.match_similar_category(
  p_user_id uuid,
  p_normalized text,
  p_threshold float
)
returns table (category_id uuid, score real)
language sql
stable
security definer
set search_path = public
as $$
  select t.category_id, similarity(t.normalized_merchant, p_normalized) as score
  from public.transactions t
  where t.user_id = p_user_id
    and t.category_id is not null
    and t.normalized_merchant is not null
    and t.normalized_merchant <> ''
    and similarity(t.normalized_merchant, p_normalized) >= p_threshold
  order by score desc
  limit 1;
$$;
