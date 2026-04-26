'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { SYMPTOMS, type PeriodEntry } from '@/lib/period-utils'

type FlowLevel = 'light' | 'medium' | 'heavy'

const FLOW_LABELS: Record<FlowLevel, string> = {
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
}

const FLOW_BG: Record<FlowLevel, string> = {
  light: 'bg-pink-300',
  medium: 'bg-red-500',
  heavy: 'bg-red-800',
}

export default function PeriodForm({
  userId,
  entry,
  initialDate,
  onDelete,
}: {
  userId: string
  entry?: PeriodEntry | null
  initialDate?: string
  onDelete?: () => void
}) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(entry?.start_date || initialDate || today)
  const [endDate, setEndDate] = useState(entry?.end_date || '')
  const [flowLevel, setFlowLevel] = useState<FlowLevel | ''>(entry?.flow_level || 'medium')
  const [symptoms, setSymptoms] = useState<string[]>(entry?.symptoms || [])
  const [notes, setNotes] = useState(entry?.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const payload = {
        start_date: startDate,
        end_date: endDate || null,
        flow_level: flowLevel || null,
        symptoms: symptoms.length > 0 ? symptoms : null,
        notes: notes || null,
      }

      if (entry) {
        const { error } = await supabase.from('period_entries').update(payload).eq('id', entry.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('period_entries').insert([{ user_id: userId, ...payload }])
        if (error) throw error
      }

      router.push('/period')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            End date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Flow</label>
        <div className="flex gap-2">
          {(['light', 'medium', 'heavy'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFlowLevel(f)}
              className={`flex-1 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 border ${
                flowLevel === f
                  ? `${FLOW_BG[f]} text-white border-transparent`
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${flowLevel === f ? 'bg-white' : FLOW_BG[f]}`} />
              {FLOW_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Symptoms</label>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition capitalize ${
                symptoms.includes(s)
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything to remember about this cycle?"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving...' : entry ? 'Update' : 'Save'}
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full py-2 text-red-500 hover:text-red-600 text-sm font-medium transition"
        >
          Delete Entry
        </button>
      )}
    </form>
  )
}
