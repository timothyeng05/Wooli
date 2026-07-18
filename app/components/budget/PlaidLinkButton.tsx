'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export default function PlaidLinkButton({ onSuccess, onComplete, className, onError, itemId, label }: {
  onSuccess?: () => void
  onComplete?: () => void  // if provided, called instead of window.location.reload()
  className?: string
  onError?: (error: string) => void
  /** When set, opens Link in update mode to re-authenticate this existing item. */
  itemId?: string
  /** Button label override (e.g. "Reconnect"). */
  label?: string
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/plaid/link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemId ? { item_id: itemId } : {}),
    })
      .then(r => r.json())
      .then(d => {
        if (d.link_token) setLinkToken(d.link_token)
        else { setError(d.error || 'Failed to load'); onError?.(d.error || 'Failed to load') }
      })
      .catch(() => { setError('Network error'); onError?.('Network error') })
  }, [itemId])

  const onPlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    setLoading(true)
    // Update mode keeps the same access token — no public-token exchange; just
    // tell the server to verify the item and clear its error status.
    const res = itemId
      ? await fetch('/api/plaid/reconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        })
      : await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token,
            institution_name: metadata.institution?.name ?? null,
            institution_id: metadata.institution?.institution_id ?? null,
          }),
        })
    setLoading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = body.error ?? (itemId ? 'Failed to reconnect institution' : 'Failed to connect institution')
      setError(msg)
      onError?.(msg)
      return
    }
    onSuccess?.()
    if (onComplete) onComplete()
    else window.location.reload()
  }, [onSuccess, onComplete, itemId, onError])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: onPlaidSuccess,
    onExit: (err) => {
      if (err) {
        const msg = err.error_message ?? err.display_message ?? 'Plaid exited with an error'
        setError(msg)
        onError?.(msg)
      }
    },
  })

  if (error) return <p className="text-sm text-red-500">Error: {error}</p>

  const idleLabel = label ?? '+ Connect Bank'
  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className={className ?? 'inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'}
    >
      {loading ? 'Connecting…' : !ready ? 'Loading…' : idleLabel}
    </button>
  )
}
