'use client'

import { useState } from 'react'

export default function SimplefinConnectButton({ onSuccess, onComplete, className, onError, connectionId, label, variant = 'button' }: {
  onSuccess?: () => void
  onComplete?: () => void  // if provided, called instead of window.location.reload()
  className?: string
  onError?: (error: string) => void
  /** When set, replaces this existing (broken) connection's access URL instead of creating a new one. */
  connectionId?: string
  /** Button label override (e.g. "Reconnect"). */
  label?: string
  /** 'menu-item' renders as a plain full-width row for use inside a dropdown. */
  variant?: 'button' | 'menu-item'
}) {
  const [open, setOpen] = useState(false)
  const [setupToken, setSetupToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!setupToken.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/simplefin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_token: setupToken.trim(), connection_id: connectionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body.error ?? (connectionId ? 'Failed to reconnect institution' : 'Failed to connect institution')
        setError(msg)
        onError?.(msg)
        return
      }
      setOpen(false)
      setSetupToken('')
      onSuccess?.()
      if (onComplete) onComplete()
      else window.location.reload()
    } catch {
      setError('Network error')
      onError?.('Network error')
    } finally {
      setLoading(false)
    }
  }

  const idleLabel = label ?? (variant === 'menu-item' ? 'Connect a bank' : '+ Connect Bank')
  const defaultClassName = variant === 'menu-item'
    ? 'w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed'
    : 'inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={className ?? defaultClassName}>
        {idleLabel}
      </button>
    )
  }

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white space-y-2 text-left">
      <p className="text-xs text-gray-500">
        Paste the setup token from your bank&apos;s SimpleFin bridge.
      </p>
      <textarea
        value={setupToken}
        onChange={e => setSetupToken(e.target.value)}
        placeholder="Setup token"
        rows={3}
        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 font-mono"
      />
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={loading || !setupToken.trim()}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting…' : 'Connect'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null) }}
          disabled={loading}
          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
