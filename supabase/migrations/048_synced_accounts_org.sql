-- A single SimpleFin setup token covers the user's whole bridge account, which
-- can span multiple institutions (e.g. one token → Citibank + Chase + Schwab
-- accounts all under one bank_connections row). Each account needs its own
-- institution identity instead of inheriting one label from the connection.
alter table public.synced_accounts add column if not exists org_name text;
alter table public.synced_accounts add column if not exists org_domain text;
