# Budget Module

**For any sub-feature, read that sub-feature's CLAUDE.md first** — each one lists exactly what to read and touch.

| Sub-feature | What it does | Start here |
|-------------|-------------|-----------|
| Transactions / monthly overview | List, search, filter, edit transactions; monthly income vs spend by category | `app/budget/transactions/CLAUDE.md` |
| Accounts & Plaid | Connect bank accounts via Plaid, sync transactions, view balance history | `app/budget/accounts/CLAUDE.md` |
| Categories | Manage the income/expense/transfer category tree used for all transactions | `app/budget/categories/CLAUDE.md` |
| Recurring rules | Define repeating transactions (rent, salary) that auto-generate each period | `app/budget/recurring/CLAUDE.md` |
| CSV import | Bulk-import transactions from Monarch, Copilot, or generic CSV exports | `app/budget/import/CLAUDE.md` |
| Cash flow | Month-by-month income vs expense charts with per-owner breakdown | `app/budget/cashflow/CLAUDE.md` |
| Goals | Savings goals linked to account balances with target date and progress | `app/budget/goals/CLAUDE.md` |
| Spend targets | Set monthly spend budgets per category and track actuals vs target | `app/budget/targets/CLAUDE.md` |
| Forecast | Net worth / retirement projection based on income streams and growth rates | `app/budget/forecast/CLAUDE.md` |

For schema and shared conventions: `docs/budget/overview.md`
For component quick-reference: `app/components/budget/CLAUDE.md`

**If you only know "budget" and nothing more specific**, read `docs/budget/overview.md` then ask which sub-feature to focus on.

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
