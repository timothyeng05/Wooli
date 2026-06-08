// Confidence thresholds for the layered categorization pipeline.
// A layer's result is only accepted when its confidence meets/exceeds its threshold;
// otherwise the pipeline falls through to the next (more expensive) layer.
export const THRESHOLDS = {
  merchant_memory: 0.95,
  // Provider (Plaid PFC) mapping only fires when Plaid's category keyword-matches one of
  // the user's own category names — that match is itself the signal, so we accept it even
  // when Plaid reports low confidence (common for obscure / foreign merchants). 0.5 is the
  // floor confidenceScore() returns for a present-but-LOW-confidence PFC, so this accepts
  // any keyword match while still rejecting the null (no-PFC) case.
  mcc_mapping: 0.5,
  similarity: 0.90,
  groq_accept: 0.75,
} as const
