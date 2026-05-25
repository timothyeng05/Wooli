# Budget Module

**Read `docs/modules/BUDGET.md` first** — it has the schema, routes, and component overview.

## Module boundary (only touch these paths)

| Area | Paths |
|------|-------|
| Routes | `app/budget/**` |
| Components | `app/components/budget/**` |
| API | `app/api/budget/**`, `app/api/plaid/**`, `app/api/cron/sync/route.ts` |
| Lib | `lib/budget/**` (`account-utils.ts`, `plaid-client.ts`, `groq-categorize.ts`) |
| DB | `categories`, `transactions`, `accounts`, `net_worth_snapshots`, `account_balance_history` |
| Migrations | `supabase/migrations/008_*`, `014_*`, `017_*`–`023_*` |

## Shared infrastructure (read-only — do not modify)

- `lib/supabase-client.ts`, `lib/supabase-server.ts` — Supabase clients
- `lib/groq.ts` — Groq AI SDK singleton
- `middleware.ts` — auth protection (budget is already in the matcher)
- `app/layout.tsx`, `app/components/Nav.tsx` — top-level shell

## DO NOT read or modify

- `app/trips/**`, `app/components/trips/**`, `lib/trips/**`
- `app/mood/**`, `app/cards/**`, `app/lists/**`, `app/period/**`
- `app/page.tsx` (dashboard hub — read-only queries, don't touch)

## Key conventions

- Server components use `lib/supabase-server.ts`; client components use `lib/supabase-client.ts`. Never mix.
- Plaid sync writes to `transactions` and `accounts`; never write directly to `net_worth_snapshots` outside the API route.
- Category hierarchy: `categories.parent_id` is null for top-level, non-null for sub-categories.
- `is_transfer = true` on a transaction means it is excluded from income/expense calculations.
