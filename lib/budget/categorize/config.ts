// Confidence thresholds for the layered categorization pipeline.
// A layer's result is only accepted when its confidence meets/exceeds its threshold;
// otherwise the pipeline falls through to the next (more expensive) layer.
export const THRESHOLDS = {
  merchant_memory: 0.95,
  mcc_mapping: 0.85,
  similarity: 0.90,
  groq_accept: 0.75,
} as const
