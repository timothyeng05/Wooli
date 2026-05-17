'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export default function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/plaid/link-token', { method: 'POST' })
      .then(r => r.json())
      .then(d => setLinkToken(d.link_token))
  }, [])

  const onPlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    setLoading(true)
    await fetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_token,
        institution_name: metadata.institution?.name ?? null,
        institution_id: metadata.institution?.institution_id ?? null,
      }),
    })
    setLoading(false)
    onSuccess?.()
    window.location.reload()
  }, [onSuccess])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: onPlaidSuccess,
  })

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Connecting…' : '+ Connect Bank'}
    </button>
  )
}
