'use client'

import { useState } from 'react'
import { useConfirm } from '@/app/components/ui/ToastProvider'

export default function RecategorizeButton() {
  const confirm = useConfirm()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [count, setCount] = useState(0)

  const run = async () => {
    if (!await confirm('Re-run AI categorization?', 'This will overwrite existing categories on ALL transactions.')) return
    setState('running')
    try {
      const res = await fetch('/api/budget/recategorize', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setCount(data.updated)
        setState('done')
        setTimeout(() => setState('idle'), 5000)
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
      onClick={run}
      disabled={state === 'running'}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 transition disabled:opacity-50"
    >
      {state === 'running' && '✦ Categorizing…'}
      {state === 'done' && `✦ ${count} categorized`}
      {state === 'error' && '⚠ Failed'}
      {state === 'idle' && '✦ Re-run AI categories'}
    </button>
  )
}
