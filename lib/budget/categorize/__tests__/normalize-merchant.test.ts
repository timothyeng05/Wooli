import { describe, it, expect } from 'vitest'
import { normalizeMerchant } from '../normalize-merchant'

describe('normalizeMerchant', () => {
  it('returns empty for nullish input', () => {
    expect(normalizeMerchant(null)).toBe('')
    expect(normalizeMerchant(undefined)).toBe('')
    expect(normalizeMerchant('')).toBe('')
  })

  it('strips a square/processor prefix and keeps the brand', () => {
    expect(normalizeMerchant('SQ *BLUE BOTTLE COFFEE')).toBe('blue bottle coffee')
    expect(normalizeMerchant('TST* JOES PIZZA')).toBe('joes pizza')
  })

  it('strips trailing location (city + state + zip)', () => {
    expect(normalizeMerchant('WHOLEFDS NEW YORK NY 10001')).toContain('wholefds')
    expect(normalizeMerchant('WHOLEFDS NEW YORK NY 10001')).not.toContain('10001')
    expect(normalizeMerchant('WHOLEFDS NEW YORK NY 10001')).not.toMatch(/\bny\b/)
  })

  it('strips dates, terminal ids, and masked card numbers', () => {
    expect(normalizeMerchant('POS DEBIT 04/12 SHELL OIL #1234')).toBe('shell oil')
    expect(normalizeMerchant('AMZN MKTP US XXXX4321')).toContain('amzn')
    expect(normalizeMerchant('AMZN MKTP US XXXX4321')).not.toMatch(/\d/)
  })

  it('drops card/network noise tokens', () => {
    expect(normalizeMerchant('VISA DEBIT CARD PURCHASE TARGET')).toBe('target')
  })

  it('is stable: same merchant with different noise collapses to the same key', () => {
    const a = normalizeMerchant('SQ *BLUE BOTTLE 0123 NEW YORK NY')
    const b = normalizeMerchant('BLUE BOTTLE COFFEE #99 BROOKLYN NY')
    expect(a).toContain('blue bottle')
    expect(b).toContain('blue bottle')
  })

  it('keeps tokens even when every word is noise (never empties a worded merchant)', () => {
    expect(normalizeMerchant('POS DEBIT')).not.toBe('')
  })
})
