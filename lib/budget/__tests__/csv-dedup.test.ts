import { describe, it, expect } from 'vitest'
import { planCsvDedup, type IncomingRow, type LegacyCandidate } from '@/lib/budget/csv-dedup'

function incoming(over: Partial<IncomingRow> = {}): IncomingRow {
  return {
    transacted_at: '2026-07-10T00:00:00',
    amount: -12.5,
    merchant: 'Blue Bottle Coffee',
    description: 'SQ *BLUE BOTTLE COFFEE 0123 NEW YORK NY',
    normalized_merchant: 'blue bottle coffee',
    ...over,
  }
}

function legacy(id: string, over: Partial<LegacyCandidate> = {}): LegacyCandidate {
  return {
    id,
    transacted_at: '2026-07-11T12:00:00',
    amount: -12.5,
    merchant: 'Blue Bottle Coffee',
    description: null,
    normalized_merchant: 'blue bottle coffee',
    ...over,
  }
}

describe('planCsvDedup', () => {
  it('merges a single exact match (amount, nearby date, same merchant)', () => {
    const plan = planCsvDedup([incoming()], [legacy('L1')])
    expect(plan.merges).toEqual([{ index: 0, legacyId: 'L1' }])
    expect(plan.inserts).toEqual([])
    expect(plan.reviews).toEqual([])
  })

  it('inserts when amounts differ', () => {
    const plan = planCsvDedup([incoming({ amount: -13.0 })], [legacy('L1')])
    expect(plan.inserts).toEqual([0])
    expect(plan.merges).toEqual([])
  })

  it('inserts when dates are more than 3 days apart', () => {
    const plan = planCsvDedup(
      [incoming({ transacted_at: '2026-07-01T00:00:00' })],
      [legacy('L1', { transacted_at: '2026-07-08T00:00:00' })],
    )
    expect(plan.inserts).toEqual([0])
  })

  it('inserts when merchants are unrelated despite matching amount+date', () => {
    const plan = planCsvDedup(
      [incoming()],
      [legacy('L1', { merchant: 'Shell Gas', normalized_merchant: 'shell gas' })],
    )
    expect(plan.inserts).toEqual([0])
  })

  it('falls back to normalizing raw merchant/description when normalized is missing', () => {
    const plan = planCsvDedup(
      [incoming({ normalized_merchant: '' })],
      [legacy('L1', { normalized_merchant: null, merchant: null, description: 'BLUE BOTTLE COFFEE NY' })],
    )
    expect(plan.merges).toHaveLength(1)
  })

  it('matches on token overlap for partially-differing merchant strings', () => {
    const plan = planCsvDedup(
      [incoming({ normalized_merchant: 'blue bottle coffee brooklyn' })],
      [legacy('L1', { normalized_merchant: 'blue bottle' })],
    )
    expect(plan.merges).toHaveLength(1)
  })

  it('flags ambiguous incoming rows (2+ candidates) for review', () => {
    const plan = planCsvDedup(
      [incoming()],
      [legacy('L1'), legacy('L2', { transacted_at: '2026-07-09T00:00:00' })],
    )
    expect(plan.reviews).toEqual([0])
    expect(plan.merges).toEqual([])
  })

  it('never lets two incoming rows consume the same legacy row', () => {
    const plan = planCsvDedup([incoming(), incoming()], [legacy('L1')])
    expect(plan.merges).toEqual([{ index: 0, legacyId: 'L1' }])
    expect(plan.inserts).toEqual([1])
  })

  it('handles a realistic mixed batch', () => {
    const rows = [
      incoming(), // dupe of L1
      incoming({ amount: -2028.73, merchant: 'Citi Payment', normalized_merchant: 'citi', description: 'CITI AUTOPAY' }), // no legacy twin
      incoming({ amount: -9.99, merchant: 'Netflix', normalized_merchant: 'netflix', transacted_at: '2026-07-05T00:00:00' }), // dupe of L3
    ]
    const candidates = [
      legacy('L1'),
      legacy('L3', { amount: -9.99, merchant: 'Netflix.com', normalized_merchant: 'netflix', transacted_at: '2026-07-06T00:00:00' }),
    ]
    const plan = planCsvDedup(rows, candidates)
    expect(plan.merges).toEqual([
      { index: 0, legacyId: 'L1' },
      { index: 2, legacyId: 'L3' },
    ])
    expect(plan.inserts).toEqual([1])
  })
})
