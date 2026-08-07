-- Let a recurring rule carry an owner, so generated transactions inherit it.
--
-- Without this the generators insert with owner = null and every generated row
-- lands unassigned, which then has to be corrected by hand each period (the
-- Hyundai depreciation entry being the case that surfaced it).
--
-- Stores household_members.full_name to match transactions.owner, which is a
-- denormalised name rather than a foreign key. Nullable: a rule with no owner
-- keeps producing unassigned transactions, exactly as before.
--
-- Additive and reversible — `alter table ... drop column owner` undoes it with
-- no effect on the transactions already generated.

alter table public.recurring_transactions
  add column if not exists owner text;
