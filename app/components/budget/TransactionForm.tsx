'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface Category {
  id: string
  name: string
  color: string
  is_income: boolean
  parent_id: string | null
}

export default function TransactionForm({
  userId,
  categories,
  defaultDate
}: {
  userId: string
  categories: Category[]
  defaultDate?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isIncome, setIsIncome] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0])

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
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        amount: signedAmount,
        description: description || null,
        merchant: merchant || null,
        category_id: categoryId || null,
        transacted_at: new Date(date).toISOString(),
      })
      if (error) throw error
      router.push('/budget')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save transaction')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Income / Expense toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => { setIsIncome(false); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            !isIncome ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => { setIsIncome(true); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            isIncome ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Income
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

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Category</label>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No category</option>
          {parents.map(parent => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.id}>{parent.name} (general)</option>
              {children
                .filter(c => c.parent_id === parent.id)
                .map(child => (
                  <option key={child.id} value={child.id}>  {child.name}</option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

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

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving...' : 'Save Transaction'}
      </button>
    </form>
  )
}
