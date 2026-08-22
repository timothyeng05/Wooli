-- Remove the 20 categories left over from the 2026-08-18 /api/setup-budget
-- re-seed (migration 057 merged the 14 that collided on name; these are the
-- rest — default categories that duplicate the user's own renamed tree
-- conceptually rather than by name).
--
-- Three of them had picked up a transaction each after the re-seed, so their
-- rows and merchant memory are repointed onto the existing equivalent before
-- the delete. Targets are matched by (name, parent name) so a bare name
-- collision elsewhere in the tree cannot steal the mapping:
--
--   Internet         (Home)     -> Utilities             (Household)
--   Home Improvement (Home)     -> Repairs & Furnishing  (Household)
--   Personal Care    (Personal) -> Grooming              (Lifestyle)
--
-- The remaining 17 are unused — no transactions, budgets, merchant memory,
-- recurring rules, or children outside this set.
--
-- Deleting the four re-seeded parents (Home, Income, Other, Personal) is safe
-- because every one of their children is itself in this set.

create temp table reseeded on commit drop as
select id from public.categories
where created_at >= '2026-08-18 16:59:00+00'
  and created_at <  '2026-08-18 17:01:00+00';

create temp table remap on commit drop as
with byname as (
  select c.id, c.name, c.user_id, p.name as parent_name
  from public.categories c left join public.categories p on p.id = c.parent_id
)
select src.id as from_id, dst.id as to_id
from (values
  ('Internet',         'Home',     'Utilities',            'Household'),
  ('Home Improvement', 'Home',     'Repairs & Furnishing',  'Household'),
  ('Personal Care',    'Personal', 'Grooming',              'Lifestyle')
) as v(src_name, src_parent, dst_name, dst_parent)
join byname src on src.name = v.src_name and src.parent_name = v.src_parent
                and src.id in (select id from reseeded)
join byname dst on dst.name = v.dst_name and dst.parent_name = v.dst_parent
                and dst.user_id = src.user_id
                and dst.id not in (select id from reseeded);

update public.transactions t set category_id = r.to_id
from remap r where t.category_id = r.from_id;

update public.merchant_memory m set category_id = r.to_id
from remap r where m.category_id = r.from_id;

update public.budgets b set category_id = r.to_id
from remap r where b.category_id = r.from_id
  and not exists (
    select 1 from public.budgets b2
    where b2.user_id = b.user_id and b2.category_id = r.to_id and b2.month = b.month
  );

delete from public.categories where id in (select id from reseeded);
