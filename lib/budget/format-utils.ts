/** Format a UTC ISO timestamp as a human-readable "last synced" string. */
export function fmtSyncTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000)
  const diffDays = Math.floor(diffMins / 1440)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffMins < 2) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffDays === 0) return `Today at ${time}`
  if (diffDays === 1) return `Yesterday at ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${time}`
}
