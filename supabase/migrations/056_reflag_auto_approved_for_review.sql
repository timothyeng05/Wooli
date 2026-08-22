-- Re-flag transactions that were auto-approved by the categorizer.
--
-- Migration 045 established the model: `needs_review` means "a human hasn't
-- verified this yet", not "the categorizer was unsure". Every new transaction
-- starts unreviewed and only an explicit user confirmation clears it.
--
-- The categorization pipeline never got the memo. `runDeterministicLayers` in
-- lib/budget/categorize/pipeline.ts built its result from a `base` object
-- carrying `needs_review: false`, so every confident merchant_memory,
-- provider_mapping and similarity_match hit was written already-reviewed and
-- never appeared in the queue. Worse, merchant memory is seeded by user
-- confirmations, so one early confirmation silently auto-approved every future
-- transaction from that merchant.
--
-- The pipeline is fixed (base now carries needs_review: true, with regression
-- tests). This backfills the rows written while it was wrong, using exactly the
-- predicate migration 045 used: anything the user never confirmed becomes
-- unreviewed. Rows with categorization_source = 'user_confirmed' reflect a real
-- human decision and are left alone.
--
-- Reversible in the sense that re-reviewing is the intended action; there is no
-- automatic undo, because "was this row auto-approved by the bug?" is exactly
-- the question this restores the ability to answer by hand.

update public.transactions
set needs_review = true
where needs_review = false
  and coalesce(categorization_source, '') <> 'user_confirmed';
