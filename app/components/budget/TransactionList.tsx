'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

interface Transaction {
  id: string
  amount: number
  description: string | null
  merchant: string | null
  transacted_at: string
  plaid_transaction_id: string | null
  is_transfer: boolean | null
  categories: { id: string; name: string; color: string } | null
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
  const [items, setItems] = useState<Transaction[]>(transactions)
  const [search, setSearch] = useState('')

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(t => t.id !== id))
  }

  const filtered = items.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.description?.toLowerCase().includes(q) ||
      t.merchant?.toLowerCase().includes(q) ||
      t.categories?.name.toLowerCase().includes(q)
    )
  })

  const grouped = groupByDate(filtered)

  if (items.length === 0) {
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
                  className="group relative flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition"
                >
                  {/* Category dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.is_transfer ? '#9ca3af' : (t.categories?.color || '#d1d5db') }}
                  />

                  {/* Description + merchant — clicking opens edit */}
                  <Link href={`/budget/${t.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.description || t.merchant || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      {t.is_transfer ? (
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Transfer</span>
                      ) : (
                        <>
                          <span className={t.categories ? '' : 'text-orange-400'}>
                            {t.categories?.name || 'Uncategorized'}
                          </span>
                          {t.plaid_transaction_id && t.categories && (
                            <span className="text-[10px] font-semibold bg-violet-100 text-violet-600 px-1 py-0.5 rounded">AI</span>
                          )}
                          {t.plaid_transaction_id && !t.categories && (
                            <span className="text-[10px] font-semibold bg-orange-100 text-orange-500 px-1 py-0.5 rounded">needs category</span>
                          )}
                        </>
                      )}
                      {t.merchant && t.description && <span>· {t.merchant}</span>}
                    </p>
                  </Link>

                  {/* Amount */}
                  <span className={`text-sm font-semibold flex-shrink-0 ${t.is_transfer ? 'text-gray-400' : t.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {t.is_transfer ? '' : t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition flex-shrink-0 text-xs"
                    aria-label="Delete transaction"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-center text-gray-500 py-8">No transactions match &quot;{search}&quot;</p>
      )}
    </div>
  )
}
