-- Hiding an account and hiding its transactions become independent switches.
--
-- Until now synced_accounts.is_hidden did both: it removed the account from the
-- accounts list AND excluded its transactions from the list, the review queue
-- and every report. exclude_from_reports already existed on both account tables
-- but was never read or written by any code; it now carries the second meaning.
--
--   is_hidden            -> hide the account row on the accounts page
--   exclude_from_reports -> hide that account's transactions everywhere
--
-- Backfill so behaviour is unchanged at the moment of the split: every account
-- currently hidden was also hiding its transactions, so it keeps doing that
-- until the user turns the new toggle off.
update public.synced_accounts
set exclude_from_reports = true
where is_hidden = true
  and coalesce(exclude_from_reports, false) = false;

-- Both columns were nullable with no default; normalise so app-side reads and
-- the PostgREST `eq` filters never have to defend against null.
update public.synced_accounts set exclude_from_reports = false where exclude_from_reports is null;
update public.accounts        set exclude_from_reports = false where exclude_from_reports is null;

alter table public.synced_accounts alter column exclude_from_reports set default false;
alter table public.accounts        alter column exclude_from_reports set default false;
