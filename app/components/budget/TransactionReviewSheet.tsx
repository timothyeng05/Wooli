'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { normalizeMerchant } from '@/lib/budget/categorize/normalize-merchant'
import { useToast } from '@/app/components/ui/ToastProvider'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import CategoryPicker from './CategoryPicker'
import type { Transaction, Category, Trip, HouseholdMember } from './transaction-types'
import { fmtMoney, fmtSignedMoney } from '@/lib/budget/format-utils'

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

/**
 * Step a date forward one period. Month and year steps clamp to the last valid
 * day so a rule anchored on the 31st lands on Feb 28 rather than overflowing
 * into March — the same rule the generator in api/budget/generate-recurring uses.
 */
function addPeriod(isoDate: string, frequency: Frequency): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (frequency === 'weekly' || frequency === 'biweekly') {
    const next = new Date(Date.UTC(y, m - 1, d))
    next.setUTCDate(next.getUTCDate() + (frequency === 'weekly' ? 7 : 14))
    return next.toISOString().split('T')[0]
  }
  const year = frequency === 'yearly' ? y + 1 : m === 12 ? y + 1 : y
  const monthIndex = frequency === 'yearly' ? m - 1 : m === 12 ? 0 : m
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

export default function TransactionReviewSheet({
  transaction,
  categories,
  trips,
  members,
  accounts = [],
  syncedAccounts = [],
  onClose,
  onSaved,
  onDelete,
}: {
  transaction: Transaction
  categories: Category[]
  trips: Trip[]
  members: HouseholdMember[]
  accounts?: { id: string; name: string; type: string }[]
  syncedAccounts?: { id: string; name: string; mask: string | null }[]
  onClose: () => void
  onSaved: (txId: string, updates: {
    is_transfer: boolean
    categories: { id: string; name: string; color: string } | null
    owner: string | null
    trip_id: string | null
    trips: { id: string; name: string } | null
    description: string | null
    merchant: string | null
    amount: number
    transacted_at: string
    account_id: string | null
    notes: string | null
    is_recurring: boolean
    recurring_id: string | null
    is_hidden: boolean
  }) => void
  onDelete: (id: string) => void
}) {
  // This sheet is the only transaction editor, so it owns every field. `mode`
  // drives the amount's sign on save; the stored amount stays the source of truth.
  const [mode, setMode] = useState<'expense' | 'income' | 'transfer'>(
    transaction.is_transfer ? 'transfer' : transaction.amount > 0 ? 'income' : 'expense'
  )
  const [amount, setAmount] = useState(Math.abs(transaction.amount).toFixed(2))
  const [date, setDate] = useState(transaction.transacted_at.split('T')[0])
  const [accountId, setAccountId] = useState(transaction.account_id ?? '')
  const [notes, setNotes] = useState(transaction.notes ?? '')
  const [isTransfer, setIsTransfer] = useState(!!transaction.is_transfer)
  const [catId, setCatId] = useState(transaction.categories?.id ?? '')
  const [owner, setOwner] = useState(transaction.owner ?? '')
  const [tripId, setTripId] = useState(transaction.trip_id ?? '')
  const [description, setDescription] = useState(transaction.description ?? '')
  const [merchant, setMerchant] = useState(transaction.merchant ?? '')
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isRecurring, setIsRecurring] = useState(!!transaction.is_recurring)
  const [isHidden, setIsHidden] = useState(!!transaction.is_hidden)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const { toast } = useToast()

  // An already-linked transaction has to show its rule's real frequency, otherwise
  // the selector would sit on the 'monthly' default and silently rewrite a weekly
  // rule the first time this sheet is saved.
  const existingRuleId = transaction.recurring_id
  useEffect(() => {
    if (!existingRuleId) return
    let cancelled = false
    createClient()
      .from('recurring_transactions')
      .select('frequency')
      .eq('id', existingRuleId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.frequency) setFrequency(data.frequency as Frequency)
      })
    return () => { cancelled = true }
  }, [existingRuleId])

  const currentCat = categories.find(c => c.id === catId) ?? null
  const catEmoji = currentCat ? getCatEmoji(currentCat.name, currentCat.icon ?? null) : null
  const catBg = currentCat?.color ? `${currentCat.color}22` : '#f3f4f6'

  const handleCatPick = (picked: string) => {
    if (picked === '__transfer__') {
      setIsTransfer(true)
      setMode('transfer')
      setCatId('')
    } else {
      setIsTransfer(false)
      if (mode === 'transfer') setMode(Number(amount) > 0 && transaction.amount > 0 ? 'income' : 'expense')
      setCatId(picked)
    }
    setCatPickerOpen(false)
  }

  const save = async () => {
    const parsed = parseFloat(amount)
    if (!isFinite(parsed) || parsed <= 0) { toast.error('Enter an amount greater than zero'); return }
    setSaving(true)
    const supabase = createClient()
    const resolvedTransfer = mode === 'transfer'
    const resolvedCatId = resolvedTransfer ? null : (catId || null)
    const resolvedTripId = tripId || null
    // Amount is stored signed; the type toggle decides the sign so the field
    // itself can stay a plain positive number.
    const signedAmount = mode === 'income' ? Math.abs(parsed) : -Math.abs(parsed)
    const resolvedDate = new Date(date + 'T12:00:00').toISOString()

    // Recurring rule is written before the transaction so the row can carry the
    // resulting rule id. The rule describes the *next* occurrence — this
    // transaction is the one that already happened.
    let recurringId = transaction.recurring_id ?? null
    if (isRecurring) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Session expired — sign in again'); setSaving(false); return }
      const anchor = new Date(date + 'T12:00:00')
      const rule = {
        user_id: user.id,
        description: description || null,
        merchant: merchant || null,
        amount: signedAmount,
        category_id: resolvedCatId,
        frequency,
        // Weekly/biweekly rules step by whole weeks, so the generator reads this
        // as a weekday index there and a calendar day otherwise.
        day_of_month: frequency === 'weekly' || frequency === 'biweekly' ? anchor.getDay() : anchor.getDate(),
        next_date: addPeriod(date, frequency),
        owner: owner || null,
        is_active: true,
      }
      if (recurringId) {
        const { error } = await supabase.from('recurring_transactions').update(rule).eq('id', recurringId)
        if (error) { toast.error(`Couldn't update the recurring rule: ${error.message}`); setSaving(false); return }
      } else {
        const { data, error } = await supabase.from('recurring_transactions').insert(rule).select('id').single()
        if (error || !data) { toast.error(`Couldn't create the recurring rule: ${error?.message ?? 'unknown error'}`); setSaving(false); return }
        recurringId = data.id
      }
    } else if (recurringId) {
      // Deactivate rather than delete — keeps any history that points at the rule.
      await supabase.from('recurring_transactions').update({ is_active: false }).eq('id', recurringId)
      recurringId = null
    }

    await supabase.from('transactions').update({
      amount: signedAmount,
      transacted_at: resolvedDate,
      account_id: accountId || null,
      notes: notes.trim() || null,
      is_transfer: resolvedTransfer,
      category_id: resolvedCatId,
      owner: owner || null,
      trip_id: resolvedTripId,
      description: description || null,
      merchant: merchant || null,
      is_recurring: isRecurring,
      recurring_id: recurringId,
      is_hidden: isHidden,
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
      amount: signedAmount,
      transacted_at: resolvedDate,
      account_id: accountId || null,
      notes: notes.trim() || null,
      is_transfer: resolvedTransfer,
      categories: found ? { id: found.id, name: found.name, color: found.color } : null,
      owner: owner || null,
      trip_id: resolvedTripId,
      trips: foundTrip ? { id: foundTrip.id, name: foundTrip.name } : null,
      description: description || null,
      merchant: merchant || null,
      is_recurring: isRecurring,
      recurring_id: recurringId,
      is_hidden: isHidden,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/20" />
        {/* Extra bottom padding on mobile: as a bottom sheet its Save/Delete row
            ends at the viewport edge, which on a notched iPhone is under the home
            indicator. sm+ renders it centred, where the plain p-6 is right. */}
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-5 max-h-[90dvh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>
          <div>
            <p className="font-semibold text-gray-900 truncate">{transaction.merchant || transaction.description || 'Transaction'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date(transaction.transacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {transaction.account_name && <> · {transaction.account_name}</>}
            </p>
          </div>

          {/* Amount + type */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-400">$</span>
              <input
                type="number" min="0.01" step="0.01" inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  mode === 'income' ? 'text-green-600' : mode === 'transfer' ? 'text-gray-500' : 'text-gray-900'
                }`}
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {(['expense', 'income', 'transfer'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); if (m === 'transfer') { setIsTransfer(true); setCatId('') } else setIsTransfer(false) }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize border transition ${
                    mode === m
                      ? m === 'income' ? 'bg-green-600 text-white border-green-600'
                        : m === 'transfer' ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</p>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

          {/* Account */}
          {(accounts.length > 0 || syncedAccounts.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Account</p>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">
                  {transaction.account_name ? `${transaction.account_name} (from bank)` : 'None'}
                </option>
                {accounts.length > 0 && (
                  <optgroup label="Manual accounts">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                )}
                {syncedAccounts.length > 0 && (
                  <optgroup label="Connected accounts">
                    {syncedAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}{a.mask ? ` ···${a.mask}` : ''}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</p>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Recurring */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recurring</p>
              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                onClick={() => setIsRecurring(v => !v)}
                className={`relative w-10 h-6 rounded-full transition ${isRecurring ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isRecurring ? 'left-[1.125rem]' : 'left-0.5'}`} />
              </button>
            </div>
            {isRecurring && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1.5">
                  {FREQUENCIES.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFrequency(f.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        frequency === f.value
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Next one generates on{' '}
                  {new Date(addPeriod(date, frequency) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
                </p>
              </div>
            )}
          </div>

          {/* Hide from totals */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hide from totals</p>
              <button
                type="button"
                role="switch"
                aria-checked={isHidden}
                onClick={() => setIsHidden(v => !v)}
                className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${isHidden ? 'bg-gray-700' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isHidden ? 'left-[1.125rem]' : 'left-0.5'}`} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isHidden
                ? 'Excluded from the summary, dashboard, cash flow and targets. Still listed here, dimmed.'
                : 'Keep a reimbursement or duplicate out of your spending without deleting it.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
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
