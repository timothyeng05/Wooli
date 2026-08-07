-- Let account_holdings reference either a manual account or a synced
-- account (brokerage statements arrive for SimpleFin-synced accounts too,
-- not just manual ones like the 401ks this table started with).
--
-- Also add cost_basis / unrealized_gain_loss: brokerage statements (e.g.
-- Schwab) report lifetime unrealized gain vs. cost basis, which is a
-- different concept from the period opening->closing gain that 401k-style
-- statements (e.g. Alight) report. Keeping them as separate nullable
-- columns instead of overloading gains_losses avoids conflating "gained
-- this period" with "gained since original purchase" when accounts sum
-- across both statement styles.

alter table public.account_holdings
  alter column account_id drop not null,
  add column synced_account_id uuid references public.synced_accounts(id) on delete cascade,
  add column cost_basis numeric(14, 2),
  add column unrealized_gain_loss numeric(14, 2);

alter table public.account_holdings
  add constraint account_holdings_one_account_ref
  check ((account_id is not null) <> (synced_account_id is not null));

alter table public.account_holdings
  drop constraint account_holdings_account_id_fund_name_statement_end_key;

create unique index account_holdings_manual_uniq
  on public.account_holdings (account_id, fund_name, statement_end)
  where account_id is not null;

create unique index account_holdings_synced_uniq
  on public.account_holdings (synced_account_id, fund_name, statement_end)
  where synced_account_id is not null;

create index account_holdings_synced_account_idx
  on public.account_holdings (synced_account_id, statement_end desc)
  where synced_account_id is not null;
