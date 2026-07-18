// First-sync dedup guard: the initial Plaid transactionsSync backfills months of
// history that overlaps rows imported from Monarch CSV (plaid_transaction_id NULL).
// Rather than inserting twins, we merge: the CSV row keeps its user-curated
// category and gains the Plaid ids, so future modified/removed events land on it.
//
// Pure planning logic lives here so it can be unit-tested without a DB.
import { normalizeMerchant } from '@/lib/budget/categorize/normalize-merchant'

export interface LegacyCandidate {
  id: string
  transacted_at: string
  amount: number
  merchant: string | null
  description: string | null
  normalized_merchant: string | null
}

export interface IncomingRow {
  transacted_at: string
  amount: number
  merchant: string | null
  description: string | null
  normalized_merchant: string
}

export interface DedupPlan {
  /** Incoming index → legacy row id to merge into (attach Plaid ids, skip insert). */
  merges: { index: number; legacyId: string }[]
  /** Incoming indexes to insert flagged needs_review (ambiguous: 2+ legacy candidates). */
  reviews: number[]
  /** Incoming indexes to insert normally. */
  inserts: number[]
}

const DAY_MS = 86_400_000
const MAX_DAY_DIFF = 3
const MIN_TOKEN_OVERLAP = 0.5

function dayNum(timestamp: string): number {
  return Date.parse(timestamp.slice(0, 10)) / DAY_MS
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean))
  const tb = new Set(b.split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let hits = 0
  for (const t of ta) if (tb.has(t)) hits++
  return hits / Math.min(ta.size, tb.size)
}

function merchantsSimilar(incoming: IncomingRow, candidate: LegacyCandidate): boolean {
  const a = incoming.normalized_merchant || normalizeMerchant(incoming.merchant ?? incoming.description)
  const b = candidate.normalized_merchant || normalizeMerchant(candidate.merchant ?? candidate.description)
  if (!a || !b) return false
  return a === b || tokenOverlap(a, b) >= MIN_TOKEN_OVERLAP
}

/**
 * Match incoming Plaid rows against legacy CSV rows. Match = exact amount,
 * dates within ±3 days, and similar merchant. Each legacy row is consumed by
 * at most one incoming row (two identical charges can't both merge into it).
 */
export function planCsvDedup(incoming: IncomingRow[], candidates: LegacyCandidate[]): DedupPlan {
  const byAmount = new Map<string, LegacyCandidate[]>()
  for (const c of candidates) {
    const key = Number(c.amount).toFixed(2)
    const list = byAmount.get(key)
    if (list) list.push(c)
    else byAmount.set(key, [c])
  }

  const consumed = new Set<string>()
  const plan: DedupPlan = { merges: [], reviews: [], inserts: [] }

  incoming.forEach((row, index) => {
    const matches = (byAmount.get(Number(row.amount).toFixed(2)) ?? []).filter(c =>
      !consumed.has(c.id) &&
      Math.abs(dayNum(c.transacted_at) - dayNum(row.transacted_at)) <= MAX_DAY_DIFF &&
      merchantsSimilar(row, c)
    )
    if (matches.length === 1) {
      consumed.add(matches[0].id)
      plan.merges.push({ index, legacyId: matches[0].id })
    } else if (matches.length > 1) {
      plan.reviews.push(index)
    } else {
      plan.inserts.push(index)
    }
  })

  return plan
}
