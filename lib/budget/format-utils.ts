/**
 * Absolute money magnitude with thousands separators and exactly 2 decimals.
 * Callers supply their own sign and currency symbol, since the budget UI shows
 * the same figure as "-$1,200.00", "+$1,200.00" or "$1,200.00" depending on
 * context. Use this anywhere money is *displayed* — `toFixed(2)` drops the
 * separators and renders "$6240.15" next to a summary line reading "$6,240.15".
 * Not for CSV export or form inputs, which need the raw unformatted number.
 */
export function fmtMoney(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Money with an explicit direction sign: "-$1,234.56" out, "+$1,234.56" in.
 * Every amount the budget UI shows should carry its direction — an unsigned
 * "$142.88" sitting next to a "+$6,240.15" reads as a credit at a glance.
 * Zero is rendered as "+$0.00"; it has no direction to convey either way.
 */
export function fmtSignedMoney(n: number): string {
  return `${n < 0 ? '-' : '+'}$${fmtMoney(n)}`
}

/** Format a UTC ISO timestamp as a human-readable "last synced" string. */
export function fmtSyncTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffMins < 2) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  // Compare local calendar dates, not raw elapsed minutes — a sync from
  // yesterday afternoon is only ~20 hours ago but must not read "Today".
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (dayDiff === 0) return `Today at ${time}`
  if (dayDiff === 1) return `Yesterday at ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${time}`
}

/** Compact relative time, e.g. "10 hours ago", "1 month ago" (Monarch-style). */
export function fmtRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}
