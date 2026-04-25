'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Transaction {
  id: string
  amount: number
  description: string | null
  merchant: string | null
  transacted_at: string
  categories: { id: string; name: string; color: string } | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByDate(txns: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  txns.forEach(t => {
    const d = t.transacted_at.split('T')[0]
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(t)
  })
  return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
}

export default function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [search, setSearch] = useState('')

  const filtered = transactions.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.description?.toLowerCase().includes(q) ||
      t.merchant?.toLowerCase().includes(q) ||
      t.categories?.name.toLowerCase().includes(q)
    )
  })

  const grouped = groupByDate(filtered)

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No transactions yet</p>
        <Link href="/budget/new" className="text-blue-600 hover:underline text-sm">Add your first transaction</Link>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search transactions..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="space-y-6">
        {grouped.map(([date, txns]) => (
          <div key={date}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="space-y-1">
              {txns.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition"
                >
                  {/* Category dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.categories?.color || '#d1d5db' }}
                  />

                  {/* Description + merchant */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.description || t.merchant || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.categories?.name || 'Uncategorized'}
                      {t.merchant && t.description && ` · ${t.merchant}`}
                    </p>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-semibold flex-shrink-0 ${t.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-center text-gray-500 py-8">No transactions match "{search}"</p>
      )}
    </div>
  )
}
