# Rules Sub-feature

User-defined categorization rules — the highest-priority deterministic layer in the
categorization pipeline. A matching rule assigns its category with confidence 1.0 and
**never** calls Groq.

## Touch only

- `app/budget/rules/page.tsx` — server component, fetches rules + categories
- `app/components/budget/RulesManager.tsx` — client CRUD (Supabase, RLS-protected)
- `lib/budget/categorize/rules.ts` — `matchUserRule` matching engine
- Rule creation affordance lives in `app/components/budget/TransactionReviewSheet.tsx`

## Schema

`categorization_rules` (migration `030_categorization_pipeline.sql`): `match_*` predicates
(normalized/raw merchant, regex, amount range, account, mcc/provider, notes) + `category_id`
or `is_transfer`. A rule matches when **all** non-null predicates hold; evaluated by
`priority asc, created_at asc`.

## Pipeline contract

Rules are layer 2 (after merchant normalization, before merchant memory). See
`lib/budget/categorize/pipeline.ts` and `docs/budget/categorization.md`.

## Do not touch

- Other budget sub-features; the Groq fallback (`lib/budget/categorize/groq-fallback.ts`)
