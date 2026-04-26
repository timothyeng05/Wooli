-- Migrate any historical mood entries tagged with 'Period' to period_entries.
-- Groups consecutive days per user into a single period_entry.

with period_days as (
  select
    user_id,
    (logged_at at time zone 'UTC')::date as day,
    row_number() over (partition by user_id order by (logged_at at time zone 'UTC')::date) as rn
  from public.mood_entries
  where 'Period' = any(activities)
),
grouped as (
  select
    user_id,
    day,
    day - (rn || ' days')::interval as group_key
  from period_days
),
ranges as (
  select
    user_id,
    min(day) as start_date,
    max(day) as end_date
  from grouped
  group by user_id, group_key
)
insert into public.period_entries (user_id, start_date, end_date, flow_level)
select user_id, start_date,
       case when start_date = end_date then null else end_date end,
       'medium'
from ranges
on conflict do nothing;

update public.mood_entries
set activities = array_remove(activities, 'Period')
where 'Period' = any(activities);
