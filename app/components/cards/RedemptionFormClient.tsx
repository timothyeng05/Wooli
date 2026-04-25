'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function RedemptionFormClient({ cardId, userId }: { cardId: string; userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [redeemedAt, setRedeemedAt] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: err } = await supabase
        .from('reward_redemptions')
        .insert([
          {
            user_id: userId,
            card_id: cardId,
            amount: amountNum,
            value: value ? parseFloat(value) : null,
            description: description.trim() || null,
            redeemed_at: new Date(redeemedAt).toISOString()
          }
        ])

      if (err) throw err

      router.push(`/cards/${cardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log redemption')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-900 mb-2">
          Amount Redeemed *
        </label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="50000"
          step="1"
          min="1"
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="text-xs text-gray-600 mt-1">Points, miles, or cashback amount</p>
      </div>

      <div>
        <label htmlFor="value" className="block text-sm font-medium text-gray-900 mb-2">
          Value in Dollars (optional)
        </label>
        <input
          id="value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="600.00"
          step="0.01"
          min="0"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="text-xs text-gray-600 mt-1">What you got in return (e.g., $600 cash back)</p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
          Description (optional)
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Hotel transfer to Hyatt, Flight booking"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="redeemedAt" className="block text-sm font-medium text-gray-900 mb-2">
          Redemption Date
        </label>
        <input
          id="redeemedAt"
          type="date"
          value={redeemedAt}
          onChange={(e) => setRedeemedAt(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 transition"
      >
        {loading ? 'Logging...' : 'Log Redemption'}
      </button>
    </form>
  )
}
