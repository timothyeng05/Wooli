-- Drop the snapshot tables taken before the 2026-08-22 category tree swap
-- (migrations 057-060). The resulting tree was reviewed and confirmed, so the
-- safety net is no longer needed.
--
-- After this the pre-swap tree is not recoverable from the database.
drop table if exists public.categories_backup_20260822;
drop table if exists public.txn_category_backup_20260822;
drop table if exists public.memory_category_backup_20260822;
drop table if exists public.budget_category_backup_20260822;
