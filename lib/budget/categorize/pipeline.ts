import type { SelectableCategory } from '@/lib/budget/groq-categorize'
import { THRESHOLDS } from './config'
import { normalizeMerchant } from './normalize-merchant'
import { matchUserRule } from './rules'
import { matchProvider } from './provider-map'
import type { CategorizeInput, CategorizeResult, PipelineContext } from './types'

function nameById(categories: SelectableCategory[]): Map<string, string> {
  return new Map(categories.map(c => [c.id, c.name]))
}

/**
 * Run the deterministic (non-Groq) layers in priority order.
 * Returns a result if a layer is confident enough, otherwise null (→ Groq fallback).
 */
async function runDeterministicLayers(
  input: CategorizeInput,
  normalized: string,
  ctx: Ctx,
  names: Map<string, string>,
): Promise<CategorizeResult | null> {
  const base = { normalized_merchant: normalized, groq_called: false, needs_review: false }

  // 2. User rules — explicit, always win, never call Groq.
  const rule = matchUserRule(input, normalized, ctx.rulesSorted)
  if (rule) {
    return {
      ...base,
      category_id: rule.is_transfer ? null : rule.category_id,
      category_name: rule.category_id ? names.get(rule.category_id) ?? null : null,
      source: 'user_rule',
      confidence: 1.0,
      is_transfer: rule.is_transfer,
    }
  }

  // 3. Merchant memory — prior confirmed categorizations for this normalized merchant.
  const mem = ctx.lookupMemory(normalized, input.account_name ?? null)
  if (mem && mem.confidence >= THRESHOLDS.merchant_memory) {
    return {
      ...base,
      category_id: mem.is_transfer ? null : mem.category_id,
      category_name: mem.category_id ? names.get(mem.category_id) ?? null : null,
      source: 'merchant_memory',
      confidence: mem.confidence,
      is_transfer: mem.is_transfer,
    }
  }

  // 4. Provider / MCC mapping — Plaid personal_finance_category → our taxonomy.
  const prov = matchProvider(input.provider_category, input.provider_confidence, ctx.categories)
  if (prov && prov.confidence >= THRESHOLDS.mcc_mapping) {
    return {
      ...base,
      category_id: prov.category_id,
      category_name: names.get(prov.category_id) ?? null,
      source: 'provider_mapping',
      confidence: prov.confidence,
      is_transfer: false,
    }
  }

  // 5. Lexical similarity — nearest previously-categorized transaction.
  const sim = await ctx.lookupSimilar(normalized, input.description ?? null)
  if (sim && sim.score >= THRESHOLDS.similarity) {
    return {
      ...base,
      category_id: sim.category_id,
      category_name: names.get(sim.category_id) ?? null,
      source: 'similarity_match',
      confidence: sim.score,
      is_transfer: false,
    }
  }

  return null
}

type Ctx = PipelineContext & { rulesSorted: PipelineContext['rules'] }

function withSortedRules(ctx: PipelineContext): Ctx {
  // Rules apply by priority asc; assume caller sorts, but enforce here for safety.
  const rulesSorted = [...ctx.rules].sort((a, b) => a.priority - b.priority)
  return { ...ctx, rulesSorted }
}

/**
 * Categorize a batch of transactions through the layered pipeline.
 * Deterministic layers run per-row; only rows that fall through all of them are sent
 * to Groq (and only when groqFallback is provided and skipGroq is not set).
 */
export async function categorizeBatch(
  inputs: CategorizeInput[],
  rawCtx: PipelineContext,
): Promise<CategorizeResult[]> {
  const ctx = withSortedRules(rawCtx)
  const names = nameById(ctx.categories)
  const results: (CategorizeResult | null)[] = new Array(inputs.length).fill(null)
  const fallThrough: { index: number; input: CategorizeInput; normalized: string }[] = []

  // Deterministic pass.
  await Promise.all(inputs.map(async (input, i) => {
    const normalized = normalizeMerchant(input.raw_merchant ?? input.description)
    const det = await runDeterministicLayers(input, normalized, ctx, names)
    if (det) results[i] = det
    else fallThrough.push({ index: i, input, normalized })
  }))

  // Groq fallback for the remainder (if enabled).
  if (fallThrough.length && ctx.groqFallback && !ctx.skipGroq) {
    const groqMap = await ctx.groqFallback(fallThrough, ctx.categories)
    for (const ft of fallThrough) {
      const g = groqMap.get(ft.index)
      const accepted = g && g.category_id && g.confidence >= THRESHOLDS.groq_accept
      results[ft.index] = {
        normalized_merchant: ft.normalized,
        groq_called: true,
        category_id: accepted ? g!.category_id : null,
        category_name: accepted ? names.get(g!.category_id!) ?? null : null,
        source: accepted ? 'groq' : 'none',
        confidence: g?.confidence ?? 0,
        is_transfer: false,
        needs_review: !accepted,
        reasoning_short: g?.reasoning_short,
        suggested_rule: accepted ? g!.suggested_rule ?? null : null,
      }
    }
  }

  // Anything still unresolved (skipGroq, or no fallback) → needs review, no Groq call.
  for (const ft of fallThrough) {
    if (results[ft.index]) continue
    results[ft.index] = {
      normalized_merchant: ft.normalized,
      groq_called: false,
      category_id: null,
      category_name: null,
      source: 'none',
      confidence: 0,
      is_transfer: false,
      needs_review: true,
      suggested_rule: null,
    }
  }

  return results as CategorizeResult[]
}

/** Single-transaction convenience wrapper. */
export async function categorizeTransaction(
  input: CategorizeInput,
  ctx: PipelineContext,
): Promise<CategorizeResult> {
  const [result] = await categorizeBatch([input], ctx)
  return result
}
