'use client'

import { useState } from 'react'

export default function SyncTransactionsButton({ lastSynced }: { lastSynced?: string | null }) {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncCount, setSyncCount] = useState<number | null>(null)

  const sync = async () => {
    setState('syncing')
    setErrorMsg(null)
    setSyncCount(null)
    try {
      const [txnRes, balRes] = await Promise.all([
        fetch('/api/plaid/sync-transactions', { method: 'POST' }),
        fetch('/api/plaid/refresh-balances', { method: 'POST' }),
      ])
      const txnData = await txnRes.json().catch(() => ({}))
      if (txnRes.ok && balRes.ok) {
        setSyncCount(txnData.added ?? 0)
        setState('done')
        setTimeout(() => { setState('idle'); setSyncCount(null); window.location.reload() }, 2500)
      } else {
        const msg = txnData?.error ?? `HTTP ${txnRes.status}`
        setErrorMsg(msg)
        setState('error')
        setTimeout(() => { setState('idle'); setErrorMsg(null) }, 4000)
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Network error')
      setState('error')
      setTimeout(() => { setState('idle'); setErrorMsg(null) }, 4000)
    }
  }

  const title = state === 'error' && errorMsg
    ? `Sync failed: ${errorMsg}`
    : lastSynced
      ? `Last synced: ${new Date(lastSynced).toLocaleString()}`
      : 'Sync now'

  return (
    <button
      onClick={sync}
      disabled={state === 'syncing'}
      title={title}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition disabled:opacity-50 ${
        state === 'done'  ? 'border-green-300 bg-green-50 text-green-600' :
        state === 'error' ? 'border-red-300 bg-red-50 text-red-500' :
        'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {state === 'done' ? (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-xs font-medium">
            {syncCount === 0 ? 'Up to date' : `+${syncCount} new`}
          </span>
        </>
      ) : (
        <svg
          className={`w-4 h-4 ${state === 'syncing' ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
      )}
    </button>
  )
}
