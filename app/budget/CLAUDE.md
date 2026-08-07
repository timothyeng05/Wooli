# Budget Module

**For any sub-feature, read that sub-feature's CLAUDE.md first** — each one lists exactly what to read and touch.

| Sub-feature | What it does | Start here |
|-------------|-------------|-----------|
| Dashboard | Budget progress, recent transactions, net worth, spending comparison — top of the sidebar | `app/budget/dashboard/CLAUDE.md` |
| Household Map | Net worth split by owner — hub diagram, risk signals, per-owner account zones | `app/budget/household-map/CLAUDE.md` |
| Transactions / monthly overview | List, search, filter, edit transactions; monthly income vs spend by category | `app/budget/transactions/CLAUDE.md` |
| Accounts & SimpleFin | Connect bank accounts via SimpleFin, sync transactions, view balance history | `app/budget/accounts/CLAUDE.md` |
| Investments | Gain/loss across investment accounts, from uploaded statement data | `app/budget/investments/CLAUDE.md` |
| Settings | Centralized hub: category tree editor + per-institution custom logos | `app/budget/settings/CLAUDE.md` |
| Categories | Manage the income/expense/transfer category tree used for all transactions (now lives inside Settings — see above) | `app/budget/categories/CLAUDE.md` |
| Recurring rules | Define repeating transactions (rent, salary) that auto-generate each period | `app/budget/recurring/CLAUDE.md` |
| CSV import | Bulk-import transactions from Monarch, Copilot, or generic CSV exports | `app/budget/import/CLAUDE.md` |
| Cash flow | Month-by-month income vs expense charts with per-owner breakdown | `app/budget/cashflow/CLAUDE.md` |
| Goals | Savings goals linked to account balances with target date and progress | `app/budget/goals/CLAUDE.md` |
| Spend targets | Set monthly spend budgets per category and track actuals vs target | `app/budget/targets/CLAUDE.md` |

For schema and shared conventions: `docs/budget/overview.md`
For component quick-reference: `app/components/budget/CLAUDE.md`

**If you only know "budget" and nothing more specific**, read `docs/budget/overview.md` then ask which sub-feature to focus on.

## Module boundary (only touch these paths)

| Area | Paths |
|------|-------|
| Routes | `app/budget/**` |
| Components | `app/components/budget/**` |
| API | `app/api/budget/**`, `app/api/simplefin/**`, `app/api/cron/sync/route.ts` |
| Lib | `lib/budget/**` (`account-utils.ts`, `simplefin-client.ts`, `groq-categorize.ts`, `categorize/**`) |
| DB | `categories`, `transactions`, `accounts`, `bank_connections`, `synced_accounts`, `net_worth_snapshots`, `account_balance_history`, `merchant_memory`, `account_holdings`, `household_members` |
| Migrations | `supabase/migrations/008_*`, `014_*`, `017_*`–`030_*`, `047_*`, `050_*`–`051_*` |

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
- SimpleFin sync writes to `transactions` and `accounts`; never write directly to `net_worth_snapshots` outside the API route.
- Category hierarchy: `categories.parent_id` is null for top-level, non-null for sub-categories.
- `is_transfer = true` on a transaction means it is excluded from income/expense calculations.
