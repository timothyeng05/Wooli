'use client'

import { useState } from 'react'

export default function SyncTransactionsButton() {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ added: number; modified: number; removed: number } | null>(null)

  const sync = async () => {
    setState('syncing')
    try {
      const res = await fetch('/api/plaid/sync-transactions', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setState('done')
        setTimeout(() => setState('idle'), 4000)
        window.location.reload()
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <button
      onClick={sync}
      disabled={state === 'syncing'}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-gray-700"
    >
      {state === 'syncing' && '⟳ Syncing…'}
      {state === 'done' && result && `✓ +${result.added} transactions`}
      {state === 'error' && '⚠ Sync failed'}
      {state === 'idle' && '⟳ Sync transactions'}
    </button>
  )
}
