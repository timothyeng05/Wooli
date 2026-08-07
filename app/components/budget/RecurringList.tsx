'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { useConfirm } from '@/app/components/ui/ToastProvider'
import { fmtMoney, fmtSignedMoney } from '@/lib/budget/format-utils'

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

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency?.toLowerCase()) {
    case 'weekly':    return amount * 52 / 12
    case 'biweekly':  return amount * 26 / 12
    case 'monthly':   return amount * 1
    case 'quarterly': return amount / 3
    case 'yearly':    return amount / 12
    default:          return amount
  }
}

function computeNextDue(item: RecurringItem, today: Date): Date | null {
  const start = item.next_date ? new Date(item.next_date + 'T00:00:00') : null
  if (!start) return null
  const d = new Date(start)
  const freq = item.frequency?.toLowerCase() ?? 'monthly'
  while (d < today) {
    if (freq === 'weekly')        d.setDate(d.getDate() + 7)
    else if (freq === 'biweekly') d.setDate(d.getDate() + 14)
    else if (freq === 'monthly')  d.setMonth(d.getMonth() + 1)
    else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3)
    else if (freq === 'yearly')   d.setFullYear(d.getFullYear() + 1)
    else break
  }
  return d
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
  const confirm = useConfirm()
  const [items, setItems] = useState(initialItems)

  const toggle = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('recurring_transactions').update({ is_active: !current }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i))
  }

  const remove = async (id: string) => {
    if (!await confirm('Delete this recurring transaction?')) return
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
        {fmtSignedMoney(item.amount)}
      </span>
      {(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const due = computeNextDue(item, today)
        if (!due) return null
        const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const label = daysUntil === 0 ? 'Due today' :
                      daysUntil < 0  ? `${Math.abs(daysUntil)}d overdue` :
                      daysUntil <= 7 ? `Due in ${daysUntil}d` :
                      due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const cls = daysUntil <= 0  ? 'bg-red-50 text-red-600' :
                    daysUntil <= 7  ? 'bg-amber-50 text-amber-700' :
                                      'bg-gray-50 text-gray-500'
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cls}`}>
            {label}
          </span>
        )
      })()}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href={`/budget/recurring/${item.id}`} className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</Link>
        <button onClick={() => toggle(item.id, item.is_active)} className="text-xs text-gray-400 hover:text-gray-700 transition">
          {item.is_active ? 'Pause' : 'Resume'}
        </button>
        <button onClick={() => remove(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition">✕</button>
      </div>
    </div>
  )

  // A negative amount is money leaving the account and a positive one is money
  // arriving — these two filters were the wrong way round, so "Monthly out"
  // reported income, "In" reported expenses, and the net came out negated (a
  // household running a healthy surplus saw it printed in red).
  const activeItems = items.filter(i => i.is_active)
  const monthlyOut = activeItems
    .filter(i => i.amount < 0)
    .reduce((sum, i) => sum + toMonthlyAmount(Math.abs(i.amount), i.frequency), 0)
  const monthlyIn = activeItems
    .filter(i => i.amount > 0)
    .reduce((sum, i) => sum + toMonthlyAmount(i.amount, i.frequency), 0)
  const monthlyNet = monthlyIn - monthlyOut

  return (
    <div>
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
      <div className="sticky bottom-0 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 mt-4">
        Monthly out: ${fmtMoney(monthlyOut)} · In: ${fmtMoney(monthlyIn)} ·{' '}
        Net:{' '}
        <span className={monthlyNet >= 0 ? 'text-green-600' : 'text-red-600'}>
          {monthlyNet < 0 ? '-' : ''}${fmtMoney(monthlyNet)}
        </span>
      </div>
    </div>
  )
}
