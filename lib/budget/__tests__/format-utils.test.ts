import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fmtSyncTime } from '@/lib/budget/format-utils'

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
