import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fmtSyncTime, fmtMoney, fmtSignedMoney } from '@/lib/budget/format-utils'

describe('fmtSignedMoney', () => {
  it('marks money out with a minus', () => {
    expect(fmtSignedMoney(-142.88)).toBe('-$142.88')
    expect(fmtSignedMoney(-1200)).toBe('-$1,200.00')
  })

  it('marks money in with a plus', () => {
    expect(fmtSignedMoney(6240.15)).toBe('+$6,240.15')
    expect(fmtSignedMoney(0)).toBe('+$0.00')
  })
})

describe('fmtMoney', () => {
  it('adds thousands separators', () => {
    expect(fmtMoney(6240.15)).toBe('6,240.15')
    expect(fmtMoney(1200)).toBe('1,200.00')
    expect(fmtMoney(1234567.5)).toBe('1,234,567.50')
  })

  it('always shows exactly two decimals', () => {
    expect(fmtMoney(8.7)).toBe('8.70')
    expect(fmtMoney(0)).toBe('0.00')
    expect(fmtMoney(99.999)).toBe('100.00')
  })

  it('returns magnitude only — callers own the sign', () => {
    expect(fmtMoney(-388400)).toBe('388,400.00')
    expect(fmtMoney(-0.5)).toBe('0.50')
  })

  it('leaves sub-thousand values unseparated', () => {
    expect(fmtMoney(142.88)).toBe('142.88')
  })
})

describe('fmtSyncTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels a sync from earlier today as "Today"', () => {
    vi.setSystemTime(new Date('2026-07-20T14:00:00'))
    const synced = new Date('2026-07-20T09:00:00').toISOString()
    expect(fmtSyncTime(synced)).toBe('Today at 9:00 AM')
  })

  it('labels a sync from yesterday afternoon as "Yesterday", even though under 24h have elapsed', () => {
    // Regression test: the old implementation bucketed by
    // floor(elapsedMinutes / 1440), a rolling 24h window from "now" rather
    // than a calendar-date comparison. A sync at 12:02 PM yesterday is only
    // ~21.5h before 9:29 AM today, so it was mislabeled "Today at 12:02 PM"
    // — a timestamp that looked like it hadn't happened yet.
    vi.setSystemTime(new Date('2026-07-20T09:29:00'))
    const synced = new Date('2026-07-19T12:02:00').toISOString()
    expect(fmtSyncTime(synced)).toBe('Yesterday at 12:02 PM')
  })

  it('labels a sync from 2+ days ago with a month/day date', () => {
    vi.setSystemTime(new Date('2026-07-20T09:29:00'))
    const synced = new Date('2026-07-17T12:02:00').toISOString()
    expect(fmtSyncTime(synced)).toBe('Jul 17 at 12:02 PM')
  })

  it('shows "Xm ago" under an hour regardless of calendar-day crossing', () => {
    vi.setSystemTime(new Date('2026-07-20T00:10:00'))
    const synced = new Date('2026-07-19T23:55:00').toISOString()
    expect(fmtSyncTime(synced)).toBe('15m ago')
  })

  it('shows "Just now" for sub-2-minute gaps', () => {
    vi.setSystemTime(new Date('2026-07-20T09:29:30'))
    const synced = new Date('2026-07-20T09:28:00').toISOString()
    expect(fmtSyncTime(synced)).toBe('Just now')
  })
})
