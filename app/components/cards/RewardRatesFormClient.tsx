'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type RateRow = {
  id?: string
  category: string
  rate: string
  notes: string
  isNew: boolean
}

const SUGGESTED_CATEGORIES = [
  'Dining',
  'Travel',
  'Groceries',
  'Gas',
  'Streaming',
  'All Other',
  'Rideshare',
  'Pharmacies',
  'Utilities',
  'Gyms',
  'Insurance'
]

export default function RewardRatesFormClient({
  cardId,
  userId,
  initialRates
}: {
  cardId: string
  userId: string
  initialRates: Array<{ id: string; category: string; rate: number; notes: string | null }>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RateRow[]>(() => {
    if (initialRates.length === 0) {
      return [{ id: '', category: '', rate: '', notes: '', isNew: true }]
    }
    return initialRates.map((r) => ({
      id: r.id,
      category: r.category,
      rate: r.rate.toString(),
      notes: r.notes || '',
      isNew: false
    }))
  })

  const handleAddRow = () => {
    setRows([...rows, { id: '', category: '', rate: '', notes: '', isNew: true }])
  }

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleRowChange = (index: number, field: keyof RateRow, value: string) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [field]: value }
    setRows(newRows)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    // Validate
    const validRows = rows.filter((r) => r.category.trim() && r.rate.trim())
    if (validRows.length === 0) {
      setError('Please add at least one reward rate')
      return
    }

    for (const row of validRows) {
      const rate = parseFloat(row.rate)
      if (isNaN(rate) || rate < 1.0) {
        setError('Rate must be a number >= 1.0')
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get existing rate IDs to keep
      const existingIds = new Set(initialRates.map((r) => r.id))

      // Find rates to delete (ones we had before but are gone now)
      const validIds = new Set(validRows.filter((r) => r.id).map((r) => r.id))
      const toDelete = Array.from(existingIds).filter((id) => !validIds.has(id))

      // Delete removed rates
      if (toDelete.length > 0) {
        const { error: deleteErr } = await supabase
          .from('card_rewards')
          .delete()
          .in('id', toDelete)

        if (deleteErr) throw deleteErr
      }

      // Insert new rates
      const newRates = validRows.filter((r) => r.isNew)
      if (newRates.length > 0) {
        const { error: insertErr } = await supabase
          .from('card_rewards')
          .insert(
            newRates.map((r) => ({
              user_id: userId,
              card_id: cardId,
              category: r.category.trim(),
              rate: parseFloat(r.rate),
              notes: r.notes.trim() || null
            }))
          )

        if (insertErr) throw insertErr
      }

      // Update existing rates
      const existingRates = validRows.filter((r) => !r.isNew)
      for (const r of existingRates) {
        const { error: updateErr } = await supabase
          .from('card_rewards')
          .update({
            category: r.category.trim(),
            rate: parseFloat(r.rate),
            notes: r.notes.trim() || null
          })
          .eq('id', r.id!)

        if (updateErr) throw updateErr
      }

      router.push(`/cards/${cardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reward rates')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <input
                list={`categories-${index}`}
                type="text"
                value={row.category}
                onChange={(e) => handleRowChange(index, 'category', e.target.value)}
                placeholder="e.g., Dining"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <datalist id={`categories-${index}`}>
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="col-span-2">
              <input
                type="number"
                value={row.rate}
                onChange={(e) => handleRowChange(index, 'rate', e.target.value)}
                placeholder="e.g., 3.0"
                step="0.1"
                min="1.0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="col-span-4">
              <input
                type="text"
                value={row.notes}
                onChange={(e) => handleRowChange(index, 'notes', e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="col-span-2">
              <button
                type="button"
                onClick={() => handleDeleteRow(index)}
                className="w-full border border-red-300 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition text-sm font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddRow}
        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
      >
        + Add Another Category
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-6 border-t">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 transition"
        >
          {loading ? 'Saving...' : 'Save Reward Rates'}
        </button>
      </div>
    </form>
  )
}
