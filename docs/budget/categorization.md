# Categorization Pipeline

Transactions are categorized by a **layered deterministic pipeline**. Groq (AI) is only
a last-resort fallback. Every transaction records which layer categorized it
(`categorization_source`) and whether Groq was called (`groq_called`).

## Layers (in order)

1. **Merchant normalization** — `lib/budget/categorize/normalize-merchant.ts`. Strips
   card/network noise, terminal/store IDs, dates, masked card numbers, and trailing
   location fragments; preserves brand words. Result stored in `transactions.normalized_merchant`.
2. **User rules** — `categorization_rules` table + `rules.ts`. All non-null `match_*`
   predicates must hold; first match (by `priority asc`) wins. Confidence 1.0, never calls Groq.
3. **Merchant memory** — `merchant_memory` table. Prior user-confirmed categorizations for
   the same normalized merchant (account-specific preferred). Accepted at ≥ 0.95.
4. **Provider mapping** — `provider-map.ts`. Maps Plaid `personal_finance_category` to a
   user category; confidence from Plaid's `confidence_level`. Accepted at ≥ 0.85.
5. **Lexical similarity** — `match_similar_category` RPC (pg_trgm). Nearest previously
   categorized transaction by trigram similarity. Accepted at ≥ 0.90.
6. **Groq fallback** — `groq-fallback.ts`. Only the rows that miss every layer above.
   Returns category + confidence + reasoning + suggested rule. Below 0.75 → Uncategorized +
   `needs_review = true`.

Thresholds live in `lib/budget/categorize/config.ts`.

## Entry point

`lib/budget/categorize/pipeline.ts` — `categorizeBatch(inputs, ctx)` / `categorizeTransaction`.
Context is built by `lib/budget/categorize/context.ts#buildPipelineContext(admin, userId, { enableGroq })`.

- **Sync** (`/api/plaid/sync-transactions`, `/api/cron/sync`): `enableGroq: false` —
  deterministic layers only, fast. Misses become `needs_review`.
- **Auto-categorize** (`/api/budget/recategorize`): `enableGroq: true` — runs Groq for the
  remainder, streams progress + per-source counts.
- **CSV import** (`/api/budget/import-csv`): Monarch categories are tagged `user_confirmed`,
  seeding merchant memory.

## Persistence (learning loop)

When a user confirms/edits a category in the UI, the update is tagged
`categorization_source = 'user_confirmed'`. A DB trigger (`record_merchant_memory`) upserts
that normalized merchant → category into `merchant_memory`, so future transactions from that
merchant categorize via layer 3 with no Groq call.

## Tests

`lib/budget/categorize/__tests__/` — `npm test`. Proves Groq is skipped for rules, merchant
memory, provider mapping, and high-confidence similarity.
