'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { normalizeMerchant } from '@/lib/budget/categorize/normalize-merchant'
import { useToast } from '@/app/components/ui/ToastProvider'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import CategoryPicker from './CategoryPicker'
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
    description: string | null
    merchant: string | null
  }) => void
  onDelete: (id: string) => void
}) {
  const [isTransfer, setIsTransfer] = useState(!!transaction.is_transfer)
  const [catId, setCatId] = useState(transaction.categories?.id ?? '')
  const [owner, setOwner] = useState(transaction.owner ?? '')
  const [tripId, setTripId] = useState(transaction.trip_id ?? '')
  const [description, setDescription] = useState(transaction.description ?? '')
  const [merchant, setMerchant] = useState(transaction.merchant ?? '')
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ruleSaving, setRuleSaving] = useState(false)
  const { toast } = useToast()

  const currentCat = categories.find(c => c.id === catId) ?? null
  const catEmoji = currentCat ? getCatEmoji(currentCat.name, currentCat.icon ?? null) : null
  const catBg = currentCat?.color ? `${currentCat.color}22` : '#f3f4f6'

  // Create a "always categorize this merchant" rule from the current selection.
  const createRule = async () => {
    const norm = normalizeMerchant(merchant || description || null)
    if (!norm) { toast.error('No merchant to make a rule from'); return }
    if (!isTransfer && !catId) { toast.error('Pick a category first'); return }
    setRuleSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setRuleSaving(false); toast.error('Not signed in'); return }
    const { error } = await supabase.from('categorization_rules').insert({
      user_id: user.id,
      name: `Always: ${norm}`,
      match_normalized_merchant: norm,
      category_id: isTransfer ? null : (catId || null),
      is_transfer: isTransfer,
      priority: 0,
    })
    setRuleSaving(false)
    if (error) toast.error(error.message)
    else toast.success(`Rule saved — "${norm}" will auto-categorize`)
  }

  const handleCatPick = (picked: string) => {
    if (picked === '__transfer__') {
      setIsTransfer(true)
      setCatId('')
    } else {
      setIsTransfer(false)
      setCatId(picked)
    }
    setCatPickerOpen(false)
  }

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
      description: description || null,
      merchant: merchant || null,
      // User confirmation → recompute normalized merchant and seed memory via trigger.
      normalized_merchant: normalizeMerchant(merchant || description || null),
      categorization_source: 'user_confirmed',
      categorization_confidence: 1,
      needs_review: false,
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
      description: description || null,
      merchant: merchant || null,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm mx-0 sm:mx-4 p-6 space-y-5 max-h-[90dvh] overflow-y-auto"
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

          {/* Merchant */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Merchant</p>
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              placeholder="e.g. Whole Foods"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</p>
            <button
              onClick={() => setCatPickerOpen(true)}
              className="w-full flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition text-left"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                style={{ backgroundColor: isTransfer ? '#f3f4f6' : catBg }}>
                {isTransfer ? '↔️' : catEmoji ? catEmoji : <span className="text-gray-400 text-xs font-bold">?</span>}
              </div>
              <span className="text-sm text-gray-700 flex-1">
                {isTransfer ? 'Transfer' : currentCat ? currentCat.name : 'Uncategorized'}
              </span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {(isTransfer || catId) && (merchant || description) && (
              <button
                onClick={createRule}
                disabled={ruleSaving}
                className="mt-1.5 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50"
              >
                {ruleSaving ? 'Saving rule…' : `✦ Always categorize "${normalizeMerchant(merchant || description || null)}" this way`}
              </button>
            )}
          </div>

          {/* Trip */}
          {trips.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Trip</p>
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner</p>
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

      {catPickerOpen && (
        <CategoryPicker
          categories={categories}
          currentCatId={catId || null}
          isTransfer={isTransfer}
          onPick={handleCatPick}
          onClose={() => setCatPickerOpen(false)}
        />
      )}
    </>
  )
}
