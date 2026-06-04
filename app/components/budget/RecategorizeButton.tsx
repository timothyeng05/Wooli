'use client'

import { useState } from 'react'
import { useConfirm } from '@/app/components/ui/ToastProvider'

export default function RecategorizeButton() {
  const confirm = useConfirm()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0, updated: 0 })
  const [errorMsg, setErrorMsg] = useState('')

  const run = async () => {
    if (!await confirm('Auto-categorize transactions?', 'AI will assign categories to transactions that don’t have one yet. Existing categories are left untouched.')) return
    setState('running')
    setProgress({ done: 0, total: 0, updated: 0 })

    try {
      const res = await fetch('/api/budget/recategorize', { method: 'POST' })
      if (!res.ok || !res.body) { setState('error'); setTimeout(() => setState('idle'), 4000); return }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalUpdated = 0

      // Read newline-delimited JSON progress events
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete trailing line
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line)
          if (evt.type === 'start') {
            setProgress({ done: 0, total: evt.total, updated: 0 })
          } else if (evt.type === 'progress') {
            setProgress({ done: evt.done, total: evt.total, updated: evt.updated })
          } else if (evt.type === 'done') {
            finalUpdated = evt.updated
            setProgress({ done: evt.total, total: evt.total, updated: evt.updated })
          } else if (evt.type === 'error') {
            setErrorMsg(evt.message ?? 'Categorization failed')
            setState('error')
            if (evt.updated) window.setTimeout(() => window.location.reload(), 2500)
            setTimeout(() => setState('idle'), 8000)
            return
          }
        }
      }

      setProgress(p => ({ ...p, updated: finalUpdated }))
      setState('done')
      setTimeout(() => { setState('idle'); window.location.reload() }, 1500)
    } catch {
      setErrorMsg('Categorization failed — check your connection')
      setState('error')
      setTimeout(() => setState('idle'), 8000)
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  if (state === 'running') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-violet-300 text-violet-700 rounded-lg bg-violet-50">
        <span className="whitespace-nowrap">✦ {pct}%</span>
        <div className="w-20 h-1.5 bg-violet-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-600 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-violet-500 whitespace-nowrap tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={run}
      title={state === 'error' ? errorMsg : undefined}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg transition disabled:opacity-50 ${
        state === 'error'
          ? 'border-red-300 text-red-600 hover:bg-red-50'
          : 'border-violet-300 text-violet-700 hover:bg-violet-50'
      }`}
    >
      {state === 'done' && `✦ ${progress.updated} categorized`}
      {state === 'error' && '⚠ Rate limited — hover for details'}
      {state === 'idle' && '✦ Auto-categorize'}
    </button>
  )
}
