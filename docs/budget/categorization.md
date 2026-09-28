# Categorization Pipeline

Transactions are categorized by a **layered deterministic pipeline**. Groq (AI) is only
a last-resort fallback. Every transaction records which layer categorized it
(`categorization_source`) and whether Groq was called (`groq_called`).

## Layers (in order)

1. **Merchant normalization** — `lib/budget/categorize/normalize-merchant.ts`. Strips
   card/network noise, terminal/store IDs, dates, masked card numbers, and trailing
   location fragments; preserves brand words. Result stored in `transactions.normalized_merchant`.
2. **Merchant memory** — `merchant_memory` table. Prior user-confirmed categorizations for
   the same normalized merchant (account-specific preferred). Accepted at ≥ 0.95.
3. **Provider mapping** — `provider-map.ts`. Maps Plaid `personal_finance_category` to a
   user category; confidence from Plaid's `confidence_level`. Accepted at ≥ 0.85. Dormant for
   new transactions since the Plaid→SimpleFin migration — SimpleFin has no category taxonomy,
   so `provider_category` is always null for synced rows and this layer never fires for them
   (same as CSV-imported rows always have). Kept only so re-running the pipeline over old
   Plaid-tagged history still works.
4. **Lexical similarity** — `match_similar_category` RPC (pg_trgm). Nearest previously
   categorized transaction by trigram similarity. Accepted at ≥ 0.90.
5. **Groq fallback** — `groq-fallback.ts`. Only the rows that miss every layer above.
   Returns category + confidence + reasoning. All Groq pre-categorized rows (and misses below 0.75) are marked with `needs_review = true` so the user can verify them.

_User-defined rules (the `categorization_rules` table) were removed 2026-07 — the deterministic
pipeline no longer has a rules layer._

Thresholds live in `lib/budget/categorize/config.ts`.

## Entry point

`lib/budget/categorize/pipeline.ts` — `categorizeBatch(inputs, ctx)` / `categorizeTransaction`.
Context is built by `lib/budget/categorize/context.ts#buildPipelineContext(admin, userId, { enableGroq })`.

- **Sync** (`/api/simplefin/sync-transactions`): `enableGroq: true` — deterministic
  layers resolve prior merchants from history; only fall-throughs hit Groq. Rows Groq
  can't place with ≥ 0.75 confidence stay `needs_review`. Route sets `maxDuration = 60`
  to give a large backfill room to finish.
- **CSV import** (`/api/budget/import-csv`): Monarch categories are tagged `user_confirmed`,
  seeding merchant memory.

## Persistence (learning loop)

When a user confirms/edits a category in the UI, the update is tagged
`categorization_source = 'user_confirmed'`. A DB trigger (`record_merchant_memory`) upserts
that normalized merchant → category into `merchant_memory`, so future transactions from that
merchant categorize via layer 3 with no Groq call.

## Tests

`lib/budget/categorize/__tests__/` — `npm test`. Proves Groq is skipped for merchant
memory, provider mapping, and high-confidence similarity.
