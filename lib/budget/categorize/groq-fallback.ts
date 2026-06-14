import Groq from 'groq-sdk'
import type { SelectableCategory } from '@/lib/budget/groq-categorize'
import type { CategorizeInput, GroqResult } from './types'

let _groq: Groq | null = null
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

// 8b-instant has a much higher free-tier daily token limit than 70b-versatile.
const CATEGORIZE_MODEL = process.env.GROQ_CATEGORIZE_MODEL ?? 'llama-3.1-8b-instant'

// Smaller chunk than the legacy categorizer: each row now also returns a confidence
// and a short reason, so the JSON per row is larger.
const CHUNK = 25

interface RawGroqRow {
  i: number
  c: number | null
  confidence?: number
  reason?: string
  rule?: string
}

function buildPrompt(
  rows: { index: number; input: CategorizeInput; normalized: string }[],
  categories: SelectableCategory[],
): string {
  const indexById = new Map(categories.map((c, i) => [c.id, i]))
  const categoryList = categories.map((c, i) => `${i}: ${c.name}`).join('\n')

  const keywordHints = categories
    .filter(c => c.keywords)
    .map(c => `- contains any of [${c.keywords}] → ${indexById.get(c.id)} (${c.name})`)
    .join('\n')
  const keywordsSection = keywordHints ? `\nUser keyword rules (highest priority):\n${keywordHints}\n` : ''

  const txList = rows
    .map((r, j) => `${j}: merchant="${r.normalized || r.input.raw_merchant || r.input.description || ''}" description="${r.input.description ?? ''}"`)
    .join('\n')

  return `You are a personal finance transaction categorizer. For each transaction pick the best category number, or null for bank/card payments, transfers, or truly unrecognizable entries.
${keywordsSection}
Available categories (use ONLY these numbers):
${categoryList}

Transactions (index: details):
${txList}

For each transaction return an object: {"i": <index>, "c": <category number or null>, "confidence": <0..1>, "reason": "<=6 words", "rule": "<optional: a reusable merchant keyword>"}.
Respond with ONLY JSON: {"results": [ ... ]} with one object per transaction in index order.`
}

async function categorizeChunk(
  rows: { index: number; input: CategorizeInput; normalized: string }[],
  categories: SelectableCategory[],
  out: Map<number, GroqResult>,
): Promise<void> {
  const res = await getGroqClient().chat.completions.create({
    model: CATEGORIZE_MODEL,
    messages: [{ role: 'user', content: buildPrompt(rows, categories) }],
    temperature: 0,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  })

  const text = res.choices[0]?.message?.content ?? ''
  if (!text) return

  const parsed = JSON.parse(text)
  const results: RawGroqRow[] = Array.isArray(parsed) ? parsed : (parsed.results ?? [])

  for (let j = 0; j < rows.length; j++) {
    const row = results.find(r => r.i === j) ?? results[j]
    if (!row) continue
    const cat = typeof row.c === 'number' ? categories[row.c] : undefined
    out.set(rows[j].index, {
      category_id: cat ? cat.id : null,
      confidence: typeof row.confidence === 'number' ? row.confidence : (cat ? 0.8 : 0),
      reasoning_short: row.reason,
      suggested_rule: row.rule && cat
        ? { match_normalized_merchant: String(row.rule).toLowerCase(), category_id: cat.id }
        : null,
    })
  }
}

/**
 * Structured Groq fallback. Categorizes the fall-through set in chunks and returns a
 * map keyed by each row's original array index. Rate-limit (429) errors propagate so
 * callers can stop and surface the limit to the user; other errors are swallowed
 * (those rows simply get no result and become needs_review downstream).
 */
export async function groqFallback(
  fallThrough: { index: number; input: CategorizeInput; normalized: string }[],
  categories: SelectableCategory[],
): Promise<Map<number, GroqResult>> {
  const out = new Map<number, GroqResult>()
  if (!fallThrough.length || !categories.length) return out

  for (let i = 0; i < fallThrough.length; i += CHUNK) {
    const chunk = fallThrough.slice(i, i + CHUNK)
    try {
      await categorizeChunk(chunk, categories, out)
    } catch (e) {
      if ((e as { status?: number })?.status === 429) throw e
      console.error('[groq-fallback] error:', e instanceof Error ? e.message : e)
    }
  }
  return out
}
