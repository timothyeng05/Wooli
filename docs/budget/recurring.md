# Budget — Recurring Rules

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/recurring` | `app/budget/recurring/page.tsx` | List all recurring rules |
| `/budget/recurring/new` | `app/budget/recurring/new/page.tsx` | Create a new recurring rule |
| `/budget/recurring/[id]` | `app/budget/recurring/[id]/page.tsx` | Edit a recurring rule |

## Components

| File | Purpose |
|------|---------|
| `RecurringList.tsx` | Table of active/inactive recurring rules with delete + toggle |
| `RecurringForm.tsx` | Create/edit form — description, merchant, amount, frequency, day, category |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/budget/generate-recurring` | Generate actual transactions from due recurring rules |

## Schema

```sql
recurring_transactions (id, user_id, description, merchant, amount, frequency,
                        day_of_month, next_date, is_active, category_id)
```

Frequency values: `'monthly'`, `'weekly'`, `'biweekly'`, `'yearly'`

## Key notes

- `next_date` is updated after each generation run — the API bumps it forward by the frequency interval.
- `generate-recurring` should be called manually or via cron; it only generates transactions with `next_date <= today`.
- `is_active = false` rules are shown in the list but skipped during generation.
- Category assignment uses `CategoryPicker` — see `docs/budget/categories.md`.
