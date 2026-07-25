-- Lets the app override two things Plaid otherwise dictates for an account:
-- 1. type_override — reclassify an account (e.g. Plaid says "credit", user wants
--    it grouped under Investments) without fighting Plaid's own categorization
--    on every sync. Null means "use Plaid's type as-is".
-- 2. sort_order — manual drag-to-reorder within a group, same convention as
--    the existing accounts.sort_order column for manual accounts.

alter table public.plaid_accounts add column if not exists type_override text
  check (type_override in ('cash', 'investment', 'credit', 'loan'));
alter table public.plaid_accounts add column if not exists sort_order integer not null default 0;
