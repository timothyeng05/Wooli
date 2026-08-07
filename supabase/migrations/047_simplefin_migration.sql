-- Full replacement of Plaid with SimpleFin for the Budget module. Renames the
-- Plaid-specific tables/columns to generic "bank connection" naming and adapts
-- the shape to SimpleFin's access-URL model (see lib/budget/simplefin-client.ts).
--
-- The 4 existing plaid_items / 15 plaid_accounts rows can't be migrated to
-- SimpleFin (their access tokens are meaningless to the new provider, and
-- SimpleFin issues new account ids on reconnect) — they are frozen here
-- (access_url nulled, status forced to 'error') so the accounts page
-- immediately prompts "needs reconnect" for every existing institution.
-- Their transactions keep their (renamed) provider_account_id /
-- provider_transaction_id values and denormalized account_name, so historical
-- reports are unaffected by the underlying account going inactive.

-- ── bank_connections (was plaid_items) ──────────────────────────────────────
alter table public.plaid_items rename to bank_connections;
alter table public.bank_connections rename column access_token to access_url;
alter table public.bank_connections alter column access_url drop not null;
alter table public.bank_connections add column if not exists org_domain text;
alter table public.bank_connections drop column if exists cursor;
alter table public.bank_connections drop column if exists institution_id;

-- ── synced_accounts (was plaid_accounts) ────────────────────────────────────
alter table public.plaid_accounts rename to synced_accounts;
alter table public.synced_accounts rename column account_id to provider_account_id;
alter table public.synced_accounts drop column if exists official_name;

-- Repoint item_id (text, fk -> old plaid_items.item_id) to connection_id
-- (uuid, fk -> bank_connections.id) now that item_id is going away.
alter table public.synced_accounts add column connection_id uuid references public.bank_connections(id);
update public.synced_accounts sa
  set connection_id = bc.id
  from public.bank_connections bc
  where bc.item_id = sa.item_id;
alter table public.synced_accounts drop constraint if exists plaid_accounts_item_id_fkey;
alter table public.synced_accounts drop column item_id;
create index if not exists synced_accounts_connection_id_idx on public.synced_accounts(connection_id);

-- Now safe to drop the old text item_id from bank_connections.
alter table public.bank_connections drop column if exists item_id;

-- ── transactions ─────────────────────────────────────────────────────────
alter table public.transactions rename column plaid_transaction_id to provider_transaction_id;
alter table public.transactions rename column plaid_account_id to provider_account_id;
alter index if exists transactions_plaid_account_idx rename to transactions_provider_account_idx;

-- ── Freeze all existing (Plaid-origin) connections ──────────────────────────
update public.bank_connections
  set access_url = null,
      status = 'error',
      error_code = 'NEEDS_RECONNECT',
      error_message = 'This institution was connected via Plaid, which Wooli no longer supports. Reconnect it via SimpleFin to resume syncing.'
  where access_url is not null; -- every pre-existing row is Plaid-origin at migration time
