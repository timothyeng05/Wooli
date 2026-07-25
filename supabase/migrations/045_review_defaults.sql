-- Review = human-verified, not "the AI was unsure".
--
-- Previously `needs_review` meant "the categorizer lacked confidence" and defaulted
-- to false, so confidently auto-categorized transactions were silently treated as
-- reviewed even though no human ever looked at them. New model: every transaction
-- starts UNREVIEWED (needs_review = true) regardless of categorization confidence,
-- and only an explicit user confirmation (review sheet, inline category pick, bulk
-- confirm, manual add, CSV import) clears it.

-- 1. New rows default to unreviewed.
alter table public.transactions alter column needs_review set default true;

-- 2. Backfill: everything the user never confirmed becomes unreviewed. Rows whose
--    categorization_source is 'user_confirmed' (manual adds, CSV imports, and prior
--    in-app confirmations) already reflect a human decision and stay reviewed.
update public.transactions
set needs_review = true
where needs_review = false
  and coalesce(categorization_source, '') <> 'user_confirmed';
