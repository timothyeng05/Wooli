-- Removes the reimbursement feature (added in 046_transaction_reimbursement.sql).
--
-- DESTRUCTIVE AND IRREVERSIBLE. Dropping this column permanently discards which
-- transactions were marked as reimbursements. There is no way to recover that
-- flag afterwards short of a point-in-time database restore. Take a backup
-- before running this if you want any way back.
--
-- Reporting impact: a flagged row used to contribute -Math.abs(amount) to its
-- category's spend total. With the feature gone it contributes +Math.abs(amount)
-- like any other expense, so every category that ever held a reimbursement will
-- report higher spend than it did before — by twice each reimbursement's value.
-- Historical dashboard, cash flow, targets and category figures will shift
-- accordingly. That is expected, not a regression.
--
-- The application code no longer reads or writes this column, so it can be run
-- before or after deploying without breaking either version.

alter table public.transactions drop column if exists is_reimbursement;
