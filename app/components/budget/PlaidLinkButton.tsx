'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export default function PlaidLinkButton({ onSuccess, onComplete, atLimit = false, className }: {
  onSuccess?: () => void
  onComplete?: () => void  // if provided, called instead of window.location.reload()
  atLimit?: boolean
  className?: string
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/plaid/link-token', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.link_token) setLinkToken(d.link_token)
        else setError(d.error || 'Failed to load')
      })
      .catch(() => setError('Network error'))
  }, [])

  const onPlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    setLoading(true)
    const res = await fetch('/api/plaid/exchange-token', {
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
      setError(body.error ?? 'Failed to connect institution')
      return
    }
    onSuccess?.()
    if (onComplete) onComplete()
    else window.location.reload()
  }, [onSuccess])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: onPlaidSuccess,
  })

  if (error) return <p className="text-sm text-red-500">Error: {error}</p>

  if (atLimit) {
    return (
      <div className="text-right">
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
        >
          + Connect Bank
        </button>
        <p className="text-xs text-amber-600 mt-1">3/3 institution limit reached</p>
      </div>
    )
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className={className ?? 'inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'}
    >
      {loading ? 'Connecting…' : !ready ? 'Loading…' : '+ Connect Bank'}
    </button>
  )
}
