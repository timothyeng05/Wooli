-- Lets a recurring_transactions row be tied back to the account that owns
-- it — used for vehicle depreciation (one monthly recurring expense per
-- vehicle, auto-managed as the vehicle's depreciation params change or the
-- vehicle is archived/deleted).
alter table public.recurring_transactions add column if not exists linked_account_id uuid references public.accounts(id) on delete cascade;
