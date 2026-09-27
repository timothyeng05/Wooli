# Wooli iOS — PM backlog

Ordered by value. Each PM cycle takes the top item, ships it, and logs it below.

## Up next
1. **AI progress indicator** — "✨ Categorizing… N left" while the on-device model works through a backlog.
2. **Bulk edit** — select several transactions → set category / mark reviewed / hide.
3. **Per-month planned amounts** — let a month override the default planned amount (Monarch does this).
4. **First-run polish** — ask for the user's name, explain review/rules briefly, empty states.
5. **Home-screen widget** — left to budget + spent this month.
6. **Siri / Shortcuts** — "How much have I spent this month?"
7. **Tests** — unit tests for RuleEngine, MerchantDirectory, BudgetPlan, statementPrefix.
8. **Accessibility pass** — VoiceOver labels, Dynamic Type on budget rows and charts.

## Done
- **Cycle 1 — Analyze with Claude** (Reports → sparkles). Builds a Markdown summary (income/spending, spending by category vs planned, top merchants, optional transaction list) with privacy toggles (account names off, bank statements off, transfers off by default), suggested questions, preview, Copy / Share. Uses the user's own Claude app; no API key.
