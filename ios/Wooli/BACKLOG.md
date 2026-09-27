# Wooli iOS — PM backlog

Ordered by value. Each PM cycle takes the top item, ships it, and logs it below.
Direction (from research on Copilot, Monarch, Rocket Money, Lunch Money, YNAB):
non-AI money-management features first.

## Up next
- **Modules Phase 2 — Period predictions in Calendar** (see MODULES_SPEC.md): opt-in EventKit calendar ("Cycle"), discreet all-day free events, rewritten on every prediction change, deleted when turned off; optional HealthKit menstrual flow.
- **Modules Phase 3 — Quick logging outside the app** (see MODULES_SPEC.md): widget extension + App Group, interactive mood widget, period status widget (Lock Screen shows no details), Control Center "Log mood", App Intents for Siri/Shortcuts, optional daily mood reminder.
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
- **Cycle 5 — Rules clean-up** (user request) — Rules screen grouped by category; group-targeted rules re-pointed at the same-named category; "Tidy up rules" (⋯ menu) lines up contains/exact and review status within a category and merges (builds on the Xcode assistant's lossless multi-value merge). User's phone: 13 → 9 rules.
- **Modules Phase 1 — Period & Mood** (per MODULES_SPEC.md): opt-in modules (Settings → Modules, default off, Show on Home, Require Face ID, delete data), Home cards after the review card, Period (CycleMath port with local-day fix, calendar, stats, history, editor) and Mood (one-tap logging, one entry per day, 30-day chart, calendar, tag patterns, editor), Face ID gate that re-locks on background, dedupe, sample data, `-module` launch arg, CycleMath + mood self-tests.
- **Budget rollover** — per category/group "Roll over what's left"; monthly close adds planned − spent to a carried-over balance stored on the category (skips months without data); remaining = planned + carried − spent; editable balance. Not yet verified on device.
