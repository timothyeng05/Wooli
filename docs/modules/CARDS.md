# Module: Credit Card Rewards Tracker

**Status:** In Progress — P1 backlog item.
**Route:** `/cards`

## Purpose

Track credit cards and their reward rates by category. Log redemptions to see which cards earn the most in user's spending patterns. Suggest best card to use for a purchase based on category.

## Routes

| Route | Purpose |
|---|---|
| `/cards` | List view — all cards with reward summary |
| `/cards/new` | Add a new credit card |
| `/cards/[id]` | Card detail — reward rates table + redemption history |
| `/cards/[id]/redeem` | Log a reward redemption |

## Schema

### `cards` table

```sql
create table public.cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,                    -- "Chase Sapphire", "AmEx Platinum"
  issuer       text not null,                    -- "Chase", "AmEx", "Capital One"
  card_type    text,                             -- "credit", "debit", "charge"
  last_four    text not null unique,             -- "4242", validation: 4 digits
  is_active    boolean default true not null,
  notes        text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table public.cards enable row level security;

create policy "Users manage own cards"
  on public.cards for all
  using (user_id = auth.uid());
```

### `card_rewards` table

Links cards to reward rates per category. One row per card + category combo.

```sql
create table public.card_rewards (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid references public.cards(id) on delete cascade not null,
  category     text not null,                    -- "dining", "travel", "groceries", "gas", "other"
  rate_percent numeric(5, 2) not null,           -- 1.00 = 1%, 5.50 = 5.5x
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null,
  unique(card_id, category)                      -- one rate per card + category
);

alter table public.card_rewards enable row level security;

create policy "Users see rewards for own cards"
  on public.card_rewards for all
  using (
    card_id in (
      select id from public.cards where user_id = auth.uid()
    )
  );
```

### `reward_redemptions` table

Log of rewards earned and redeemed.

```sql
create table public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  card_id      uuid references public.cards(id) on delete cascade not null,
  category     text not null,                    -- "dining", "travel", etc.
  amount       numeric(10, 2) not null,          -- $ amount spent
  rate_percent numeric(5, 2) not null,           -- reward rate applied
  points_earned numeric(10, 2) not null,         -- amount * (rate / 100)
  redeemed     boolean default false not null,
  redeemed_at  timestamptz,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table public.reward_redemptions enable row level security;

create policy "Users manage own redemptions"
  on public.reward_redemptions for all
  using (user_id = auth.uid());
```

**Triggers:** Apply `handle_updated_at()` trigger on both `card_rewards` and `reward_redemptions`.

## Field Notes

- `cards.last_four` — stored as string for display, no full card numbers stored
- `card_rewards.rate_percent` — stored as percentage (1.00 = 1%, 5.50 = 5.5x)
- `card_rewards.unique(card_id, category)` — one reward rate per category per card (upsert target)
- `reward_redemptions.points_earned` — computed as `amount * (rate_percent / 100)` for audit trail
- `reward_redemptions.redeemed` — flag when points have been cashed out

## Components

```
src/components/cards/
  CardCard.tsx               ← display a single card (name, issuer, top rewards)
  CardForm.tsx               ← create/edit card form
  CardRewardRates.tsx        ← table of reward rates by category (editable)
  RedemptionForm.tsx         ← log a new redemption (category + amount picker)
  RedemptionHistory.tsx      ← list of past redemptions, total points
```

## Dashboard Widget

Show:
- Top 2 cards by total points earned (this month)
- Best category across all cards
- Total unredeemed points

Data source: join `cards` → `reward_redemptions`, group by card, filter `redeemed = false`.

## Build Order

1. **Run migrations** (create 3 tables + RLS policies + triggers)
2. **Test RLS** — log in as user A, create a card; log in as user B, verify they can't see it
3. **`src/app/cards/page.tsx`** — list cards (server component fetches, client renders)
4. **`src/app/cards/new/page.tsx`** — add card form (CardForm client component)
5. **`src/app/cards/[id]/page.tsx`** — card detail (show reward rates table, redemption history)
6. **`src/app/cards/[id]/redeem/page.tsx`** — redemption logging form
7. **Dashboard widget**

## Notes

- Card rewards are user-editable (rates change; AmEx matches bonus categories seasonally)
- Redemptions are append-only; no edit/delete (audit trail)
- Consider bulk import from card issuer CSVs later (out of scope for MVP)
