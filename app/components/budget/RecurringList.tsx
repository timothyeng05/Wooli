'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

interface RecurringItem {
  id: string
  description: string | null
  merchant: string | null
  amount: number
  frequency: string
  day_of_month: number | null
  next_date: string
  is_active: boolean
  categories: { id: string; name: string; color: string } | null
}

interface Category { id: string; name: string; parent_id: string | null }

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', weekly: 'Weekly', biweekly: 'Biweekly', yearly: 'Yearly',
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function scheduleLabel(item: RecurringItem) {
  const freq = FREQ_LABELS[item.frequency] ?? item.frequency
  if (item.frequency === 'weekly' || item.frequency === 'biweekly') {
    return `${freq} on ${DAYS[item.day_of_month ?? 0]}`
  }
  if (item.day_of_month) return `${freq} on the ${item.day_of_month}${ordinal(item.day_of_month)}`
  return freq
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return 'th'
  return ['th','st','nd','rd'][n % 10] ?? 'th'
}

export default function RecurringList({
  userId,
  initialItems,
  categories,
}: {
  userId: string
  initialItems: RecurringItem[]
  categories: Category[]
}) {
  const [items, setItems] = useState(initialItems)

  const toggle = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('recurring_transactions').update({ is_active: !current }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i))
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this recurring transaction?')) return
    const supabase = createClient()
    await supabase.from('recurring_transactions').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🔁</p>
        <p className="text-gray-500 mb-6">No recurring transactions yet</p>
        <Link href="/budget/recurring/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Add Recurring
        </Link>
      </div>
    )
  }

  const active = items.filter(i => i.is_active)
  const inactive = items.filter(i => !i.is_active)

  const renderItem = (item: RecurringItem) => (
    <div key={item.id} className={`flex items-center gap-3 px-4 py-3.5 border rounded-xl transition ${item.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.categories?.color ?? '#d1d5db' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.description || item.merchant || 'No description'}</p>
        <p className="text-xs text-gray-400">
          {item.categories?.name ?? 'Uncategorized'} · {scheduleLabel(item)} · next {new Date(item.next_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
      <span className={`text-sm font-semibold flex-shrink-0 ${item.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
        {item.amount >= 0 ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href={`/budget/recurring/${item.id}`} className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</Link>
        <button onClick={() => toggle(item.id, item.is_active)} className="text-xs text-gray-400 hover:text-gray-700 transition">
          {item.is_active ? 'Pause' : 'Resume'}
        </button>
        <button onClick={() => remove(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition">✕</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(renderItem)}
        </div>
      )}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Paused</p>
          <div className="space-y-2">{inactive.map(renderItem)}</div>
        </div>
      )}
    </div>
  )
}
