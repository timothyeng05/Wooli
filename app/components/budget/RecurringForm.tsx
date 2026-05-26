'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useToast } from '@/app/components/ui/ToastProvider'

interface Category { id: string; name: string }

function nextDateFor(frequency: string, dayOfMonth: number): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  if (frequency === 'monthly' || frequency === 'yearly') {
    const candidate = new Date(year, month, dayOfMonth)
    if (candidate <= today) {
      if (frequency === 'monthly') return new Date(year, month + 1, dayOfMonth).toISOString().split('T')[0]
      return new Date(year + 1, month, dayOfMonth).toISOString().split('T')[0]
    }
    return candidate.toISOString().split('T')[0]
  }

  // weekly / biweekly — default to next occurrence of selected day
  const dayOfWeek = dayOfMonth % 7
  const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff).toISOString().split('T')[0]
}

export default function RecurringForm({
  userId,
  categories,
  item,
}: {
  userId: string
  categories: Category[]
  item?: {
    id: string
    description: string | null
    merchant: string | null
    amount: number
    category_id: string | null
    frequency: string
    day_of_month: number | null
    next_date: string
    is_active: boolean
  }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = !!item
  const [saving, setSaving] = useState(false)
  const [isIncome, setIsIncome] = useState(isEdit ? item.amount > 0 : false)
  const [amount, setAmount] = useState(isEdit ? Math.abs(item.amount).toString() : '')
  const [description, setDescription] = useState(isEdit ? (item.description ?? '') : '')
  const [merchant, setMerchant] = useState(isEdit ? (item.merchant ?? '') : '')
  const [categoryId, setCategoryId] = useState(isEdit ? (item.category_id ?? '') : '')
  const [frequency, setFrequency] = useState(isEdit ? item.frequency : 'monthly')
  const [dayOfMonth, setDayOfMonth] = useState(isEdit ? (item.day_of_month ?? 1) : 1)
  const [nextDate, setNextDate] = useState(isEdit ? item.next_date : '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)

    const computedNextDate = nextDate || nextDateFor(frequency, dayOfMonth)

    const payload = {
      user_id: userId,
      description: description || null,
      merchant: merchant || null,
      amount: isIncome ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount)),
      category_id: categoryId || null,
      frequency,
      day_of_month: dayOfMonth,
      next_date: computedNextDate,
      is_active: true,
    }

    try {
      const supabase = createClient()
      if (isEdit) {
        const { error } = await supabase.from('recurring_transactions').update(payload).eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recurring_transactions').insert(payload)
        if (error) throw error
      }
      router.push('/budget/recurring')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Income / Expense */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button type="button" onClick={() => { setIsIncome(false); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${!isIncome ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          Expense
        </button>
        <button type="button" onClick={() => { setIsIncome(true); setCategoryId('') }}
          className={`flex-1 py-2.5 text-sm font-medium transition ${isIncome ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          Income
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" required
            className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Description</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Netflix, Rent, Gym"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Merchant */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Merchant <span className="text-gray-400 font-normal">(optional)</span></label>
        <input type="text" value={merchant} onChange={e => setMerchant(e.target.value)}
          placeholder="e.g. Netflix"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Category</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">No category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Frequency + day */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">Frequency</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {frequency === 'weekly' || frequency === 'biweekly' ? 'Day of week' : 'Day of month'}
          </label>
          {frequency === 'weekly' || frequency === 'biweekly' ? (
            <select value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          ) : (
            <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
        </div>
      </div>

      {/* Next date override */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">
          Next date <span className="text-gray-400 font-normal">(auto-calculated if left blank)</span>
        </label>
        <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <button type="submit" disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recurring Transaction'}
      </button>
    </form>
  )
}
