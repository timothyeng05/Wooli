-- Travel carried both the combined categories (Flights & Hotels, Transit &
-- Rideshare) and the seeded split ones (Flights, Hotels, Transit, Rideshare)
-- after migration 059 restored the seeded tree. They overlap in meaning but not
-- in name, so the dedupe in 057 never touched them.
--
-- All the history sits on the combined pair — Flights & Hotels has 8
-- transactions and 38 merchant-memory rows, Transit & Rideshare has 25 and 44 —
-- while the split four are entirely empty. So this is a plain delete with
-- nothing to repoint.
--
-- The delete is guarded on the usage counts rather than trusting that snapshot:
-- it only fires for rows nothing references, so a transaction assigned to one of
-- these in the meantime keeps its category instead of being silently orphaned.

delete from public.categories c
using public.categories p
where c.parent_id = p.id
  and p.parent_id is null
  and p.name = 'Travel'
  and c.name in ('Flights', 'Hotels', 'Transit', 'Rideshare')
  and not exists (select 1 from public.transactions t    where t.category_id = c.id)
  and not exists (select 1 from public.merchant_memory m where m.category_id = c.id)
  and not exists (select 1 from public.budgets b         where b.category_id = c.id)
  and not exists (select 1 from public.categories ch     where ch.parent_id  = c.id);
