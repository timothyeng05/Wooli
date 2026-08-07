-- Drops six tables that no application code references.
--
-- DESTRUCTIVE AND IRREVERSIBLE.
--
-- Five are empty orphans of removed features:
--   categorization_rules        - user rules, removed 2026-07
--   reward_redemptions          - Cards module, route deleted
--   template_benefits           - benefits sync, routes deleted
--   account_balance_snapshots   - superseded by account_balance_history
--   list_shares                 - list sharing, never wired to any UI
--
-- The sixth is not empty:
--   transactions_backup_20260805 - 2027 rows, the pre-SimpleFin snapshot.
--   Dropping it discards the only copy of the pre-migration transaction data.
--
-- list_shares needs care. Every policy on list_items references it, so a plain
-- `drop table ... cascade` would delete all four, leaving list_items with RLS
-- enabled and no policies at all - i.e. readable by nobody. The policies are
-- recreated owner-only below before the table goes.
--
-- This also fixes a latent hole: the old select and insert policies compared
-- `ls.list_id = ls.list_id` (always true) rather than `list_items.list_id`, so
-- any user holding one share row could read or insert into every list. It never
-- fired because list_shares has always been empty.

-- 1. lists: owner policies already cover access; drop the shared-user branch.
drop policy if exists "Shared users select lists" on public.lists;

-- 2. list_items: replace all four policies with owner-only equivalents.
drop policy if exists "Accessible list items select" on public.list_items;
drop policy if exists "Accessible list items insert" on public.list_items;
drop policy if exists "Accessible list items update" on public.list_items;
drop policy if exists "Accessible list items delete" on public.list_items;

create policy "Owners select list items" on public.list_items
  for select using (
    exists (select 1 from public.lists l
            where l.id = list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners insert list items" on public.list_items
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.lists l
                where l.id = list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners update list items" on public.list_items
  for update using (
    exists (select 1 from public.lists l
            where l.id = list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners delete list items" on public.list_items
  for delete using (
    exists (select 1 from public.lists l
            where l.id = list_items.list_id and l.user_id = auth.uid())
  );

-- 3. Drop the tables. No other table has a foreign key into any of them.
drop table if exists public.list_shares;
drop table if exists public.categorization_rules;
drop table if exists public.reward_redemptions;
drop table if exists public.template_benefits;
drop table if exists public.account_balance_snapshots;
drop table if exists public.transactions_backup_20260805;
