'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useToast } from '@/app/components/ui/ToastProvider'

interface Category {
  id: string
  name: string
  color: string
  is_income: boolean
  parent_id: string | null
}

interface Account {
  id: string
  name: string
  type: string
}

interface ExistingTransaction {
  id: string
  amount: number
  description: string | null
  merchant: string | null
  category_id: string | null
  account_id: string | null
  transacted_at: string
  is_transfer: boolean | null
  owner: string | null
  notes: string | null
}

const OWNERS = ['Timothy Eng', 'Jessica Li', 'Shared'] as const

export default function TransactionForm({
  userId,
  categories,
  accounts = [],
  defaultDate,
  transaction,
}: {
  userId: string
  categories: Category[]
  accounts?: Account[]
  defaultDate?: string
  transaction?: ExistingTransaction
}) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = !!transaction
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'expense' | 'income' | 'transfer'>(
    isEdit ? (transaction.is_transfer ? 'transfer' : transaction.amount > 0 ? 'income' : 'expense') : 'expense'
  )
  const isIncome = mode === 'income'
  const isTransfer = mode === 'transfer'
  const [amount, setAmount] = useState(isEdit ? Math.abs(transaction.amount).toString() : '')
  const [description, setDescription] = useState(isEdit ? (transaction.description || '') : '')
  const [merchant, setMerchant] = useState(isEdit ? (transaction.merchant || '') : '')
  const [categoryId, setCategoryId] = useState(isEdit ? (transaction.category_id || '') : '')
  const [accountId, setAccountId] = useState(isEdit ? (transaction.account_id || '') : '')
  const [date, setDate] = useState(
    isEdit
      ? transaction.transacted_at.split('T')[0]
      : defaultDate || new Date().toISOString().split('T')[0]
  )
  const [owner, setOwner] = useState(isEdit ? (transaction.owner || '') : 'Timothy Eng')
  const [notes, setNotes] = useState(isEdit ? (transaction.notes || '') : '')

  const filteredCategories = categories.filter(c => c.is_income === isIncome)
  const parents = filteredCategories.filter(c => !c.parent_id)
  const children = filteredCategories.filter(c => !!c.parent_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setLoading(true)

    try {
      const supabase = createClient()
      const signedAmount = isIncome ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount))
      const payload = {
        amount: signedAmount,
        description: description || null,
        merchant: merchant || null,
        category_id: isTransfer ? null : (categoryId || null),
        account_id: accountId || null,
        transacted_at: new Date(date + 'T12:00:00').toISOString(),
        is_transfer: isTransfer,
        owner: owner || null,
        notes: notes || null,
      }

      if (isEdit) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', transaction.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('transactions').insert({ user_id: userId, ...payload })
        if (error) throw error
      }

      router.push('/budget')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save transaction')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Expense / Income / Transfer toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => { setMode('expense'); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            mode === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => { setMode('income'); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            mode === 'income' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Income
        </button>
        <button
          type="button"
          onClick={() => { setMode('transfer'); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            mode === 'transfer' ? 'bg-gray-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Transfer
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this for?"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Merchant */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Merchant <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          type="text"
          value={merchant}
          onChange={e => setMerchant(e.target.value)}
          placeholder="e.g. Whole Foods, Netflix"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category — hidden for transfers */}
      {!isTransfer && <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Category</label>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No category</option>
          {parents.map(parent => {
            const subs = children.filter(c => c.parent_id === parent.id)
            if (subs.length === 0) {
              return <option key={parent.id} value={parent.id}>{parent.name}</option>
            }
            return (
              <optgroup key={parent.id} label={parent.name}>
                {subs.map(child => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>}

      {/* Account */}
      {accounts.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">Account <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No account</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
            ))}
          </select>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Owner */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Owner <span className="text-gray-400 font-normal">(optional)</span></label>
        <select
          value={owner}
          onChange={e => setOwner(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No owner</option>
          {OWNERS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Transaction'}
      </button>
    </form>
  )
}
