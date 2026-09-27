# Wooli iOS — PM backlog

Ordered by value. Each PM cycle takes the top item, ships it, and logs it below.
Direction (from research on Copilot, Monarch, Rocket Money, Lunch Money, YNAB):
non-AI money-management features first.

## Up next
1. **Budget rollover** — unspent (or overspent) amounts carry into next month, per category (Copilot, YNAB).
2. **Recurring in the budget** — count bills still due this month into "left to spend" (Copilot).
3. **Savings goals** — target amount/date linked to an account's balance (Monarch, YNAB).
4. **Bulk edit** — select several transactions → set category / mark reviewed / hide.
5. **Per-month planned amounts** — let a month override the default planned amount.
6. **Home-screen widget** — left to budget, next bills.
7. **Tests** — RuleEngine, MerchantDirectory, RecurringDetector, BudgetPlan, statementPrefix.
8. **Accessibility pass** — VoiceOver labels, Dynamic Type on budget rows and charts.

## Done
- **Cycle 1 — Analyze with Claude** — shipped, then removed at the user's request (not practical); replaced by non-AI features.
- **Cycle 2 — Recurring bills & subscriptions** — detects repeating charges and income by merchant + amount + schedule (weekly, every 2 weeks, twice a month, monthly, quarterly, yearly); stricter for everyday spending and two-sighting cases; separates several series per merchant by amount. Recurring screen (still due / paid / haven't seen lately / not tracking), editor (name, amount, cadence, next date, category, history), Dashboard card, Budget ⋯ menu, "Mark as recurring" on transactions. Items persist separately so they survive the 2-month transaction window.
- **Cycle 3 — Split transactions + skip review per merchant** — split a posted transaction into parts (own category + amount, must add up; original set aside, parts labelled; edit/undo). "Always <category> for <merchant> · skip review" creates a merchant rule that also marks reviewed and clears existing ones; behind press-and-hold on "Mark as reviewed" (review card and transaction screen) plus a switch in the quick category sheet, so it can't be tapped by accident.
- **Cycle 4 — Tags + rule fixes** — tags on transactions (editor section, picker with create/reuse, shown in rows), Tags filter, Tags card in Reports, "Add tag" rule action, split parts keep tags. Rules created from a transaction or while reviewing now default to "Mark as reviewed" so matches leave the review queue (user report: "Apply to 5 existing" seemed to do nothing); quick sheet's two rule switches merged into one.
