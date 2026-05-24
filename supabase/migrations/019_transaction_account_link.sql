-- Link transactions to their Plaid account and store display name
-- plaid_account_id: the Plaid string account_id (matches plaid_accounts.account_id)
-- account_name: human-readable label, from Plaid or CSV

alter table public.transactions add column if not exists plaid_account_id text;
alter table public.transactions add column if not exists account_name text;

create index if not exists transactions_plaid_account_idx
  on public.transactions (plaid_account_id);
