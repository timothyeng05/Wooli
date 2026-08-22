-- Let a single transaction be hidden from reports without deleting it.
--
-- `is_transfer` already excludes a row from income/expense maths, but it also
-- relabels it as a transfer, which is wrong for the cases this is for: a
-- reimbursed work expense, a duplicate the bank posted twice, a one-off that
-- would distort a category's trend. Those are real expenses on a real account —
-- they just shouldn't count toward spend.
--
-- Monarch's semantics, which the rest of this module follows: a hidden
-- transaction stays visible in the transaction list (dimmed, badged) so it can
-- be found and unhidden, but is excluded from every total — the list summary
-- bar, day subtotals, dashboard, cash flow, and spend targets.
--
-- Additive and reversible: `alter table ... drop column is_hidden` undoes it.
-- NOT NULL with a false default so every read can treat it as a plain boolean
-- rather than defending against null the way `is_transfer` has to.

alter table public.transactions
  add column if not exists is_hidden boolean not null default false;

-- Reports filter on `is_hidden = false` over a user's rows in a date range.
-- Partial on the hidden rows only: they're the rare case, so this stays tiny
-- and lets the planner skip them without scanning an index of mostly-false.
create index if not exists transactions_hidden_idx
  on public.transactions (user_id, transacted_at)
  where is_hidden;
