'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { getCatEmoji } from '@/app/components/budget/catEmoji'

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  parent_id: string | null
}

interface Transaction {
  id: string
  amount: number
  merchant: string | null
  description: string | null
  transacted_at: string
  is_pending: boolean | null
  owner: string | null
  account_name: string | null
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n: number): string {
  if (n >= 10000) return `$${Math.round(n / 1000)}k`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

function MonthlyBarChart({ transactions, color }: { transactions: Transaction[]; color: string }) {
  const now = new Date()

  const months = useMemo(() => {
    const result = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return result
  }, [])

  const totals = useMemo(() =>
    months.map(({ year, month }) =>
      transactions
        .filter(t => {
          const d = new Date(t.transacted_at)
          return d.getFullYear() === year && d.getMonth() === month
        })
        .reduce((s, t) => s + Math.abs(t.amount), 0)
    ), [transactions, months])

  // Average over months that have any spend
  const monthsWithData = totals.filter(v => v > 0)
  const avg = monthsWithData.length > 0
    ? monthsWithData.reduce((s, v) => s + v, 0) / monthsWithData.length
    : 0

  const maxVal = Math.max(...totals, avg, 1)
  const W = 600, H = 150, LABEL_H = 20
  const chartH = H - LABEL_H
  const GAP = 6
  const barW = (W - GAP * (months.length - 1)) / months.length

  // Average line Y position
  const avgY = avg > 0 ? chartH - (avg / maxVal) * (chartH - 10) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      {months.map(({ month }, i) => {
        const isCurrent = i === months.length - 1
        const val = totals[i]
        const barH = val > 0 ? Math.max((val / maxVal) * (chartH - 10), 8) : 0
        const x = i * (barW + GAP)
        const y = chartH - barH
        return (
          <g key={i}>
            {barH > 0 && (
              <rect x={x} y={y} width={barW} height={barH} rx={3}
                fill={isCurrent ? color : `${color}55`} />
            )}
            {/* Monthly sum label inside bar */}
            {barH >= 18 && (
              <text x={x + barW / 2} y={y + barH / 2 + 4}
                textAnchor="middle" fontSize="9" fontWeight="700"
                fill={isCurrent ? 'white' : '#374151'}>
                {fmtShort(val)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 2}
              textAnchor="middle" fontSize="9"
              fill={isCurrent ? '#111827' : '#9ca3af'}
              fontWeight={isCurrent ? '700' : '400'}>
              {MONTH_ABBR[month].toUpperCase()}
            </text>
          </g>
        )
      })}
      {/* Average line */}
      {avgY !== null && (
        <g>
          <line x1={0} y1={avgY} x2={W} y2={avgY}
            stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
          <text x={W - 2} y={avgY - 3}
            textAnchor="end" fontSize="8" fill="#6b7280" opacity="0.8">
            avg ${avg >= 1000 ? `${(avg/1000).toFixed(1)}k` : avg.toFixed(0)}
          </text>
        </g>
      )}
    </svg>
  )
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

export default function CategoryDetailClient({
  category,
  transactions,
  parentCategory,
}: {
  category: Category
  transactions: Transaction[]
  parentCategory?: { id: string; name: string; icon: string | null } | null
}) {
  const color = category.color || '#6b7280'
  const emoji = getCatEmoji(category.name, category.icon)
  const total = transactions.reduce((s, t) => s + Math.abs(t.amount), 0)
  const avg = transactions.length > 0 ? total / transactions.length : 0
  const grouped = useMemo(() => groupByDate(transactions), [transactions])

  // Monthly totals for chart + avg per month
  const now = new Date()
  const months12 = useMemo(() => {
    const result = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return result
  }, [])
  const monthlyTotals = useMemo(() =>
    months12.map(({ year, month }) =>
      transactions.filter(t => {
        const d = new Date(t.transacted_at)
        return d.getFullYear() === year && d.getMonth() === month
      }).reduce((s, t) => s + Math.abs(t.amount), 0)
    ), [transactions, months12])
  const monthsWithData = monthlyTotals.filter(v => v > 0)
  const avgPerMonth = monthsWithData.length > 0
    ? monthsWithData.reduce((s, v) => s + v, 0) / monthsWithData.length
    : 0

  const thisMonthTotal = monthlyTotals[11] ?? 0

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      {parentCategory && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href={`/budget/categories/${parentCategory.id}`} className="hover:text-gray-600 transition">
            {getCatEmoji(parentCategory.name, parentCategory.icon)} {parentCategory.name}
          </Link>
          <span>›</span>
          <span className="text-gray-600">{category.name}</span>
        </div>
      )}

      {/* Chart card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-3">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">This month</p>
            <p className="text-3xl font-bold text-gray-900">${fmt(thisMonthTotal)}</p>
          </div>
          <p className="text-xs text-gray-400">{transactions.length} transactions total</p>
        </div>
        <MonthlyBarChart transactions={transactions} color={color} />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <p className="text-sm font-bold text-gray-900 mb-3">Summary</p>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total (all time)</span>
            <span className="text-sm font-semibold text-gray-900">${fmt(total)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Avg per month</span>
            <span className="text-sm font-semibold text-gray-900">${fmt(avgPerMonth)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Average transaction</span>
            <span className="text-sm font-semibold text-gray-900">${fmt(avg)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total transactions</span>
            <span className="text-sm font-semibold text-gray-900">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Transactions</p>
          <span className="text-sm text-gray-400">{transactions.length} · ${fmt(total)}</span>
        </div>
        {grouped.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">No transactions yet</p>
        ) : (
          grouped.map(([date, txns]) => {
            const dayTotal = txns.reduce((s, t) => s + Math.abs(t.amount), 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between px-5 py-2 bg-gray-50 border-y border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                  <span className="text-xs text-gray-400">${fmt(dayTotal)}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {txns.map(t => {
                    const name = t.merchant || t.description || 'Unknown'
                    return (
                      <Link key={t.id} href={`/budget/${t.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                            {t.is_pending && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">P</span>
                            )}
                          </div>
                          {t.account_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{t.account_name}</p>
                          )}
                        </div>
                        <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                          t.amount >= 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount).toFixed(2)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
