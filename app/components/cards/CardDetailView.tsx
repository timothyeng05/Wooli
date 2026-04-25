'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function CardDetailView({
  card,
  coreValue,
  netValue
}: {
  card: {
    id: string
    name: string
    issuer: string | null
    network: string | null
    annual_fee: number | null
    is_active: boolean
  }
  coreValue: number
  netValue: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(card.is_active)

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this card?')) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('cards').update({ is_active: false }).eq('id', card.id)
      if (error) throw error
      setIsActive(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate card')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('cards').update({ is_active: true }).eq('id', card.id)
      if (error) throw error
      setIsActive(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate card')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure? This will permanently delete the card and all associated data.')) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('cards').delete().eq('id', card.id)
      if (error) throw error
      router.push('/cards')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete card')
      setLoading(false)
    }
  }

  const netPositive = netValue >= 0

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-1">{card.name}</h1>
          <p className="text-gray-600">{card.issuer || 'Unknown Issuer'}</p>
        </div>
        <span
          className={`px-4 py-2 rounded-full font-medium text-sm ${
            isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b">
        {card.network && (
          <div>
            <p className="text-sm text-gray-600">Network</p>
            <p className="font-semibold text-gray-900 capitalize">{card.network}</p>
          </div>
        )}
        <div>
          <p className="text-sm text-gray-600">Annual Fee</p>
          <p className="font-semibold text-gray-900">
            {card.annual_fee !== null ? `$${card.annual_fee.toFixed(0)}` : 'None'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Benefits Value</p>
          <p className="font-semibold text-green-600">${coreValue.toFixed(0)}/yr</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Net Value</p>
          <p className={`font-semibold ${netPositive ? 'text-green-600' : 'text-red-600'}`}>
            {netPositive ? '+' : '-'}${Math.abs(netValue).toFixed(0)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {isActive ? (
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition text-sm font-medium"
          >
            Deactivate
          </button>
        ) : (
          <button
            onClick={handleActivate}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 transition text-sm font-medium"
          >
            Activate
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition text-sm font-medium"
        >
          Delete Card
        </button>
      </div>
    </div>
  )
}
