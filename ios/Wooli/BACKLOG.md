# Wooli iOS — PM backlog

Ordered by value. Each PM cycle takes the top item, ships it, and logs it below.
Direction (from research on Copilot, Monarch, Rocket Money, Lunch Money, YNAB):
non-AI money-management features first.

## Up next
1. **Split transactions** — one Costco trip across Groceries + Home Supplies (Lunch Money, Monarch).
2. **Tags** — e.g. "Japan trip" across restaurants, hotels, transit; tag totals in Reports (Lunch Money, Monarch).
3. **Budget rollover** — unspent (or overspent) amounts carry into next month, per category (Copilot, YNAB).
4. **Recurring in the budget** — count bills still due this month into "left to spend" (Copilot).
5. **Savings goals** — target amount/date linked to an account's balance (Monarch, YNAB).
6. **Bulk edit** — select several transactions → set category / mark reviewed / hide.
7. **Per-month planned amounts** — let a month override the default planned amount.
8. **Home-screen widget** — left to budget, next bills.
9. **Tests** — RuleEngine, MerchantDirectory, RecurringDetector, BudgetPlan, statementPrefix.
10. **Accessibility pass** — VoiceOver labels, Dynamic Type on budget rows and charts.

## Done
- **Cycle 1 — Analyze with Claude** — shipped, then removed at the user's request (not practical); replaced by non-AI features.
- **Cycle 2 — Recurring bills & subscriptions** — detects repeating charges and income by merchant + amount + schedule (weekly, every 2 weeks, twice a month, monthly, quarterly, yearly); stricter for everyday spending and two-sighting cases; separates several series per merchant by amount. Recurring screen (still due / paid / haven't seen lately / not tracking), editor (name, amount, cadence, next date, category, history), Dashboard card, Budget ⋯ menu, "Mark as recurring" on transactions. Items persist separately so they survive the 2-month transaction window.
