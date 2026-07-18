-- Plaid item health tracking: lets sync capture per-institution errors
-- (e.g. ITEM_LOGIN_REQUIRED) instead of aborting the whole run, and lets
-- the accounts page show connection status + a Reconnect button.

alter table public.plaid_items add column if not exists status text not null default 'healthy'; -- healthy | error
alter table public.plaid_items add column if not exists error_code text;                        -- e.g. ITEM_LOGIN_REQUIRED
alter table public.plaid_items add column if not exists error_message text;
alter table public.plaid_items add column if not exists last_successful_sync_at timestamptz;
alter table public.plaid_items add column if not exists last_sync_attempt_at timestamptz;
