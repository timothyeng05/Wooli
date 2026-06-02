'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import type { Transaction, Category, Trip, HouseholdMember } from './transaction-types'

export default function TransactionReviewSheet({
  transaction,
  categories,
  trips,
  members,
  onClose,
  onSaved,
  onDelete,
}: {
  transaction: Transaction
  categories: Category[]
  trips: Trip[]
  members: HouseholdMember[]
  onClose: () => void
  onSaved: (txId: string, updates: {
    is_transfer: boolean
    categories: { id: string; name: string; color: string } | null
    owner: string | null
    trip_id: string | null
    trips: { id: string; name: string } | null
  }) => void
  onDelete: (id: string) => void
}) {
  const [isTransfer, setIsTransfer] = useState(!!transaction.is_transfer)
  const [catId, setCatId] = useState(transaction.categories?.id ?? '')
  const [owner, setOwner] = useState(transaction.owner ?? '')
  const [tripId, setTripId] = useState(transaction.trip_id ?? '')
  const [saving, setSaving] = useState(false)

  const parents = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => !!c.parent_id)

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const resolvedCatId = isTransfer ? null : (catId || null)
    const resolvedTripId = tripId || null
    await supabase.from('transactions').update({
      is_transfer: isTransfer,
      category_id: resolvedCatId,
      owner: owner || null,
      trip_id: resolvedTripId,
    }).eq('id', transaction.id)
    const found = resolvedCatId ? (categories.find(c => c.id === resolvedCatId) ?? null) : null
    const foundTrip = resolvedTripId ? (trips.find(tp => tp.id === resolvedTripId) ?? null) : null
    setSaving(false)
    onSaved(transaction.id, {
      is_transfer: isTransfer,
      categories: found ? { id: found.id, name: found.name, color: found.color } : null,
      owner: owner || null,
      trip_id: resolvedTripId,
      trips: foundTrip ? { id: foundTrip.id, name: foundTrip.name } : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm mx-0 sm:mx-4 p-6 space-y-5"
        onClick={e => e.stopPropagation()}>
        <div>
          <p className="font-semibold text-gray-900 truncate">{transaction.merchant || transaction.description || 'Transaction'}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date(transaction.transacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {transaction.account_name && <> · {transaction.account_name}</>}
          </p>
          <p className={`text-2xl font-bold mt-1 ${transaction.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
          </p>
        </div>

        {/* Type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</p>
          <div className="flex gap-2">
            {(['income/expense', 'transfer'] as const).map(type => (
              <button key={type} onClick={() => setIsTransfer(type === 'transfer')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  (type === 'transfer') === isTransfer
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {type === 'transfer' ? 'Transfer' : 'Income / Expense'}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        {!isTransfer && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</p>
            <select value={catId} onChange={e => setCatId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Uncategorized</option>
              {parents.map(parent => {
                const subs = children.filter(c => c.parent_id === parent.id)
                const pEmoji = getCatEmoji(parent.name, parent.icon)
                if (subs.length === 0) return <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                return (
                  <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                    {subs.map(child => (
                      <option key={child.id} value={child.id}>{getCatEmoji(child.name, child.icon)} {child.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>
        )}

        {/* Trip */}
        {trips.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trip</p>
            <select value={tripId} onChange={e => setTripId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              {trips.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Owner */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Owner</p>
          <div className="flex gap-2">
            {(['', ...members.map(m => m.full_name)] as string[]).map(fullName => {
              const member = members.find(m => m.full_name === fullName)
              const isSelected = owner === fullName
              return (
                <button key={fullName || '__none__'} onClick={() => setOwner(fullName)}
                  style={isSelected && member ? { backgroundColor: member.color, borderColor: member.color, color: 'white' } : undefined}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                    isSelected && !member ? 'bg-gray-100 text-gray-600 border-gray-200'
                    : isSelected ? ''
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}>
                  {member ? member.display_name : 'None'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link href={`/budget/${transaction.id}`}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Edit
          </Link>
          <button onClick={() => { onClose(); onDelete(transaction.id) }}
            className="px-4 py-2.5 border border-red-100 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
