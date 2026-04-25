'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function CardFormClient({ userId }: { userId: string }) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [issuer, setIssuer] = useState('')
  const [network, setNetwork] = useState('visa')
  const [rewardsType, setRewardsType] = useState('points')
  const [rewardsUnit, setRewardsUnit] = useState('')
  const [hasAnnualFee, setHasAnnualFee] = useState(false)
  const [annualFee, setAnnualFee] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (loading || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data, error: err } = await supabase
        .from('cards')
        .insert([
          {
            user_id: userId,
            name,
            issuer: issuer || null,
            network,
            rewards_type: rewardsType,
            rewards_unit: rewardsUnit,
            has_annual_fee: hasAnnualFee,
            annual_fee: hasAnnualFee && annualFee ? parseFloat(annualFee) : null,
            is_active: true
          }
        ])
        .select()

      if (err) throw err

      if (data && data[0]) {
        router.push(`/cards/${data[0].id}/edit-rates`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card')
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
          Card Name *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chase Sapphire Preferred"
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="issuer" className="block text-sm font-medium text-gray-900 mb-2">
          Issuer
        </label>
        <input
          id="issuer"
          type="text"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder="Chase"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="network" className="block text-sm font-medium text-gray-900 mb-2">
            Network *
          </label>
          <select
            id="network"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="amex">American Express</option>
            <option value="discover">Discover</option>
          </select>
        </div>

        <div>
          <label htmlFor="rewardsType" className="block text-sm font-medium text-gray-900 mb-2">
            Rewards Type *
          </label>
          <select
            id="rewardsType"
            value={rewardsType}
            onChange={(e) => setRewardsType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="points">Points</option>
            <option value="miles">Miles</option>
            <option value="cashback">Cashback</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="rewardsUnit" className="block text-sm font-medium text-gray-900 mb-2">
          Rewards Unit *
        </label>
        <input
          id="rewardsUnit"
          type="text"
          value={rewardsUnit}
          onChange={(e) => setRewardsUnit(e.target.value)}
          placeholder="Ultimate Rewards points"
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center">
          <input
            id="hasAnnualFee"
            type="checkbox"
            checked={hasAnnualFee}
            onChange={(e) => setHasAnnualFee(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="hasAnnualFee" className="ml-3 text-sm font-medium text-gray-900">
            This card has an annual fee
          </label>
        </div>

        {hasAnnualFee && (
          <div>
            <label htmlFor="annualFee" className="block text-sm font-medium text-gray-900 mb-2">
              Annual Fee ($)
            </label>
            <input
              id="annualFee"
              type="number"
              value={annualFee}
              onChange={(e) => setAnnualFee(e.target.value)}
              placeholder="95.00"
              step="0.01"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
      >
        {loading ? 'Adding card...' : 'Add Card'}
      </button>
    </form>
  )
}
