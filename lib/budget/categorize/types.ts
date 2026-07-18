import type { SelectableCategory } from '@/lib/budget/groq-categorize'

export type CategorizationSource =
  | 'user_rule'
  | 'merchant_memory'
  | 'mcc_mapping'
  | 'provider_mapping'
  | 'similarity_match'
  | 'groq'
  | 'user_confirmed'
  | 'none'

/** Raw inputs the pipeline needs to categorize one transaction. */
export interface CategorizeInput {
  /** Optional caller-side id, echoed back for correlation in batch mode. */
  id?: string
  raw_merchant: string | null
  description: string | null
  amount?: number | null
  account_name?: string | null
  /** Plaid personal_finance_category.detailed (or primary). */
  provider_category?: string | null
  /** Plaid personal_finance_category.confidence_level. */
  provider_confidence?: string | null
  notes?: string | null
  mcc?: string | null
}

export interface CategorizeResult {
  category_id: string | null
  category_name: string | null
  source: CategorizationSource
  confidence: number
  normalized_merchant: string
  is_transfer: boolean
  needs_review: boolean
  groq_called: boolean
  reasoning_short?: string
}

export interface MerchantMemoryEntry {
  normalized_merchant: string
  account_name: string | null
  category_id: string | null
  is_transfer: boolean
  confidence: number
}

export interface SimilarityMatch {
  category_id: string
  score: number
}

/** Structured per-transaction output from the Groq fallback. */
export interface GroqResult {
  category_id: string | null
  confidence: number
  reasoning_short?: string
}

/**
 * Groq fallback signature (injected so the pipeline is testable without a network call).
 * Receives only the fall-through set; returns a map keyed by the input's array index.
 */
export type GroqFallbackFn = (
  fallThrough: { index: number; input: CategorizeInput; normalized: string }[],
  categories: SelectableCategory[],
) => Promise<Map<number, GroqResult>>

/** Dependencies for the pipeline, injected by the caller (DB-backed in prod, stubbed in tests). */
export interface PipelineContext {
  categories: SelectableCategory[]
  /** Exact merchant-memory lookup (prefer account-specific over account-agnostic). */
  lookupMemory: (normalized: string, accountName: string | null) => MerchantMemoryEntry | undefined
  /** Lexical-similarity lookup over previously categorized transactions (e.g. pg_trgm RPC). */
  lookupSimilar: (normalized: string, description: string | null) => Promise<SimilarityMatch | null>
  /** Groq fallback. Omit (or set skipGroq) to run deterministic layers only. */
  groqFallback?: GroqFallbackFn
  skipGroq?: boolean
}
