'use client'

import { useState } from 'react'
import { fmtSyncTime } from '@/lib/budget/format-utils'

export default function SyncTransactionsButton({ lastSynced }: { lastSynced?: string | null }) {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ added: number } | null>(null)

  const sync = async () => {
    setState('syncing')
    try {
      const [txnRes] = await Promise.all([
        fetch('/api/plaid/sync-transactions', { method: 'POST' }),
        fetch('/api/plaid/refresh-balances', { method: 'POST' }),
      ])
      const data = await txnRes.json()
      if (txnRes.ok) {
        setResult(data)
        setState('done')
        setTimeout(() => setState('idle'), 4000)
        window.location.reload()
      } else {
        setState('error')
        setTimeout(() => setState('idle'), 4000)
      }
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <button
      onClick={sync}
      disabled={state === 'syncing'}
      className="flex flex-col items-center justify-center px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-gray-700 min-w-[52px]"
    >
      <span className="flex items-center gap-1 text-sm font-medium leading-tight">
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 ${state === 'syncing' ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        {state === 'syncing' && 'Syncing…'}
        {state === 'done' && result && `+${result.added}`}
        {state === 'error' && 'Failed'}
        {state === 'idle' && 'Sync'}
      </span>
      {state === 'idle' && (
        <span className="text-[10px] text-gray-400 leading-tight mt-0.5">
          {lastSynced ? fmtSyncTime(lastSynced) : 'Never synced'}
        </span>
      )}
    </button>
  )
}
