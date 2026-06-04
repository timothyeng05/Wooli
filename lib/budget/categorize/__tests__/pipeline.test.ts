import { describe, it, expect, vi } from 'vitest'
import { categorizeTransaction } from '../pipeline'
import type { SelectableCategory } from '@/lib/budget/groq-categorize'
import type {
  CategorizeInput, GroqResult, MerchantMemoryEntry, PipelineContext, SimilarityMatch, UserRule,
} from '../types'

const CATEGORIES: SelectableCategory[] = [
  { id: 'cat-coffee', name: 'Coffee' },
  { id: 'cat-shop', name: 'Shopping' },
  { id: 'cat-groc', name: 'Food → Groceries' },
]

// Build a context with sensible "miss everything" defaults; override per test.
function makeCtx(over: Partial<PipelineContext> & { groqResult?: GroqResult }): {
  ctx: PipelineContext
  groqSpy: ReturnType<typeof vi.fn>
} {
  const groqSpy = vi.fn(async (fallThrough: { index: number }[]) => {
    const map = new Map<number, GroqResult>()
    if (over.groqResult) for (const ft of fallThrough) map.set(ft.index, over.groqResult)
    return map
  })

  const ctx: PipelineContext = {
    categories: CATEGORIES,
    rules: over.rules ?? [],
    lookupMemory: over.lookupMemory ?? (() => undefined),
    lookupSimilar: over.lookupSimilar ?? (async () => null),
    groqFallback: over.groqFallback ?? groqSpy,
    skipGroq: over.skipGroq ?? false,
  }
  return { ctx, groqSpy }
}

const input = (raw: string, extra: Partial<CategorizeInput> = {}): CategorizeInput => ({
  raw_merchant: raw, description: raw, ...extra,
})

describe('categorization pipeline — Groq is skipped when a deterministic layer is confident', () => {
  it('user_rule: matches a rule and never calls Groq', async () => {
    const rules: UserRule[] = [{
      id: 'r1', priority: 0,
      match_normalized_merchant: 'starbucks', match_raw_merchant: null, match_regex: null,
      match_amount_min: null, match_amount_max: null, match_account_name: null,
      match_mcc: null, match_notes: null, category_id: 'cat-coffee', is_transfer: false,
    }]
    const { ctx, groqSpy } = makeCtx({ rules })
    const r = await categorizeTransaction(input('STARBUCKS #1234 SEATTLE WA'), ctx)

    expect(r.source).toBe('user_rule')
    expect(r.category_id).toBe('cat-coffee')
    expect(r.groq_called).toBe(false)
    expect(groqSpy).not.toHaveBeenCalled()
  })

  it('merchant_memory: reuses a confirmed mapping (>=0.95) without Groq', async () => {
    const mem: MerchantMemoryEntry = {
      normalized_merchant: 'whole foods', account_name: null,
      category_id: 'cat-groc', is_transfer: false, confidence: 1.0,
    }
    const { ctx, groqSpy } = makeCtx({ lookupMemory: () => mem })
    const r = await categorizeTransaction(input('WHOLE FOODS MKT'), ctx)

    expect(r.source).toBe('merchant_memory')
    expect(r.category_id).toBe('cat-groc')
    expect(r.groq_called).toBe(false)
    expect(groqSpy).not.toHaveBeenCalled()
  })

  it('provider_mapping: maps Plaid PFC (>=0.85) without Groq', async () => {
    const { ctx, groqSpy } = makeCtx({})
    const r = await categorizeTransaction(
      input('SOME GROCERY', { provider_category: 'FOOD_AND_DRINK_GROCERIES', provider_confidence: 'HIGH' }),
      ctx,
    )

    expect(r.source).toBe('provider_mapping')
    expect(r.category_id).toBe('cat-groc')
    expect(r.groq_called).toBe(false)
    expect(groqSpy).not.toHaveBeenCalled()
  })

  it('similarity_match: reuses nearest match (>=0.90) without Groq', async () => {
    const sim: SimilarityMatch = { category_id: 'cat-shop', score: 0.95 }
    const { ctx, groqSpy } = makeCtx({ lookupSimilar: async () => sim })
    const r = await categorizeTransaction(input('TARGET STORE 42'), ctx)

    expect(r.source).toBe('similarity_match')
    expect(r.category_id).toBe('cat-shop')
    expect(r.groq_called).toBe(false)
    expect(groqSpy).not.toHaveBeenCalled()
  })

  it('low-confidence provider mapping does NOT short-circuit (falls through to Groq)', async () => {
    const { ctx, groqSpy } = makeCtx({
      groqResult: { category_id: 'cat-coffee', confidence: 0.9 },
    })
    const r = await categorizeTransaction(
      input('MYSTERY', { provider_category: 'FOOD_AND_DRINK_GROCERIES', provider_confidence: 'LOW' }),
      ctx,
    )
    // LOW → 0.5 < 0.85 threshold, so provider is rejected and Groq runs.
    expect(r.source).toBe('groq')
    expect(r.groq_called).toBe(true)
    expect(groqSpy).toHaveBeenCalledOnce()
  })
})

describe('categorization pipeline — Groq fallback', () => {
  it('calls Groq when all deterministic layers miss, and accepts a confident result', async () => {
    const { ctx, groqSpy } = makeCtx({
      groqResult: { category_id: 'cat-shop', confidence: 0.9, reasoning_short: 'online retailer' },
    })
    const r = await categorizeTransaction(input('SOME UNKNOWN SHOP LLC'), ctx)

    expect(groqSpy).toHaveBeenCalledOnce()
    expect(r.source).toBe('groq')
    expect(r.category_id).toBe('cat-shop')
    expect(r.groq_called).toBe(true)
    expect(r.needs_review).toBe(false)
  })

  it('marks low-confidence Groq results as Uncategorized + needs_review', async () => {
    const { ctx } = makeCtx({
      groqResult: { category_id: 'cat-shop', confidence: 0.5 }, // below groq_accept (0.75)
    })
    const r = await categorizeTransaction(input('TOTALLY AMBIGUOUS'), ctx)

    expect(r.category_id).toBeNull()
    expect(r.needs_review).toBe(true)
    expect(r.source).toBe('none')
    expect(r.groq_called).toBe(true)
  })

  it('skipGroq: never calls Groq; unresolved rows become needs_review', async () => {
    const { ctx, groqSpy } = makeCtx({ skipGroq: true })
    const r = await categorizeTransaction(input('UNKNOWN MERCHANT'), ctx)

    expect(groqSpy).not.toHaveBeenCalled()
    expect(r.source).toBe('none')
    expect(r.needs_review).toBe(true)
    expect(r.groq_called).toBe(false)
  })
})
