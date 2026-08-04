-- A reimbursement keeps its category_id (e.g. still "Travel") — unlike is_transfer,
-- it is NOT nulled out and the row is NOT excluded from totals. Every aggregation
-- site must contribute -Math.abs(amount) for these rows instead of +Math.abs(amount),
-- so a category's net spend can go negative (a net gain) when reimbursement exceeds
-- the original charge. Direction is driven by this flag, never inferred from sign.
alter table public.transactions add column if not exists is_reimbursement boolean not null default false;
