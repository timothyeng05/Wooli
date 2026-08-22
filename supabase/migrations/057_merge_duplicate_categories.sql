-- Merge the duplicate categories created by a re-run of /api/setup-budget.
--
-- On 2026-08-18 16:59:59–17:00:00 UTC that route seeded its full 34-category
-- default tree on top of an existing, already-customised tree. The sort_order
-- fingerprint is conclusive: parents at 0..6 in DEFAULT_CATEGORIES order and
-- children at 7 + parentIndex*10 + childIndex, which is exactly that route's
-- formula.
--
-- The likely trigger is /api/reset-onboarding, which deletes every category and
-- clears onboarding_completed_at, after which onboarding re-seeds. At the time
-- its only guard was an email check for woolitravel@gmail.com, which does not
-- match this account; commit 8069fd6 later added the NODE_ENV gate that closes
-- this off. That route's delete has no error handling, so a partial failure
-- would have passed silently and left the originals in place — which is what
-- the data looks like.
--
-- Merge rule: for each (user, name, top-level-or-not) group with more than one
-- row, the OLDEST row wins — that is the category the user has actually been
-- using. Newer copies have their transactions, budgets, merchant memory and
-- child categories repointed onto the winner, then are deleted.
--
-- Note the pairs mostly sit under different parents (Lifestyle/Personal,
-- General/Other, Household/Home, Earnings/Income) because the user had renamed
-- the top-level categories; those are the same concept under a renamed vs
-- default parent, so older-wins is still the correct merge.

create temp table cat_merge on commit drop as
with d as (
  select id, user_id, name, created_at,
         first_value(id) over (
           partition by user_id, name, (parent_id is null) order by created_at
         ) as keep_id,
         count(*) over (
           partition by user_id, name, (parent_id is null)
         ) as copies
  from public.categories
)
select id as loser_id, keep_id, user_id, name
from d
where copies > 1 and id <> keep_id;

-- budgets is unique on (user_id, category_id, month): drop a loser's budget row
-- only where the winner already has one for that month, so the repoint below
-- cannot violate the constraint. (Currently zero rows — this is a guard.)
delete from public.budgets b
using cat_merge m
where b.category_id = m.loser_id
  and exists (
    select 1 from public.budgets b2
    where b2.user_id = b.user_id and b2.category_id = m.keep_id and b2.month = b.month
  );

update public.transactions t set category_id = m.keep_id
from cat_merge m where t.category_id = m.loser_id;

update public.budgets b set category_id = m.keep_id
from cat_merge m where b.category_id = m.loser_id;

-- merchant_memory is unique on (user_id, normalized_merchant, account_name),
-- which excludes category_id, so repointing here cannot collide.
update public.merchant_memory mm set category_id = m.keep_id
from cat_merge m where mm.category_id = m.loser_id;

-- Reparent children of a duplicate parent onto the surviving parent. Runs
-- against the same map, so a child that is itself a duplicate is deleted below
-- rather than left dangling.
update public.categories c set parent_id = m.keep_id
from cat_merge m where c.parent_id = m.loser_id;

delete from public.categories c
using cat_merge m where c.id = m.loser_id;
