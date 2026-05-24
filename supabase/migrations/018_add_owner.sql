-- Add owner field to track who each transaction / account belongs to
-- Values: 'Timothy Eng', 'Jessica Li', 'Shared', or NULL

alter table public.transactions    add column if not exists owner text;
alter table public.accounts        add column if not exists owner text;
alter table public.plaid_accounts  add column if not exists owner text;
