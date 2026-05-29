'use client'

import { useState, useMemo } from 'react'
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

// ── Period bar chart ───────────────────────────────────────────────────────────
function PeriodBarChart({
  totals, labels, color, selectedIdx, onSelect,
}: {
  totals: number[]
  labels: string[]
  color: string
  selectedIdx: number
  onSelect: (i: number) => void
}) {
  const n = totals.length
  const W = 600, H = 150, LABEL_H = 20
  const chartH = H - LABEL_H
  const GAP = n > 8 ? 3 : 6
  const barW = (W - GAP * (n - 1)) / n

  const monthsWithData = totals.filter(v => v > 0)
  const avg = monthsWithData.length > 0
    ? monthsWithData.reduce((s, v) => s + v, 0) / monthsWithData.length
    : 0
  const maxVal = Math.max(...totals, avg, 1)
  const avgY = avg > 0 ? chartH - (avg / maxVal) * (chartH - 10) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      {totals.map((val, i) => {
        const isSelected = i === selectedIdx
        const barH = val > 0 ? Math.max((val / maxVal) * (chartH - 10), 8) : 0
        const x = i * (barW + GAP)
        const y = chartH - barH
        return (
          <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            {/* Invisible hit area so empty bars are still clickable */}
            <rect x={x} y={0} width={barW} height={chartH} fill="transparent" />
            {barH > 0 && (
              <rect x={x} y={y} width={barW} height={barH} rx={3}
                fill={isSelected ? color : `${color}55`} />
            )}
            {barH >= 18 && (
              <text x={x + barW / 2} y={y + barH / 2 + 4}
                textAnchor="middle" fontSize="9" fontWeight="700"
                fill={isSelected ? 'white' : '#374151'}>
                {fmtShort(val)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 2}
              textAnchor="middle" fontSize="9"
              fill={isSelected ? '#111827' : '#9ca3af'}
              fontWeight={isSelected ? '700' : '400'}>
              {labels[i]}
            </text>
          </g>
        )
      })}
      {avgY !== null && (
        <g>
          <line x1={0} y1={avgY} x2={W} y2={avgY}
            stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
          <text x={W - 2} y={avgY - 3}
            textAnchor="end" fontSize="8" fill="#6b7280" opacity="0.8">
            avg {fmtShort(avg)}
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

  const [view, setView] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const handleSetView = (v: 'monthly' | 'yearly') => {
    setView(v)
    setSelectedIdx(null)
  }

  // ── Build periods ────────────────────────────────────────────────────────────
  const { periods, totals, labels } = useMemo(() => {
    if (view === 'monthly') {
      const now = new Date()
      const ps: { year: number; month: number }[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        ps.push({ year: d.getFullYear(), month: d.getMonth() })
      }
      const tots = ps.map(({ year, month }) =>
        transactions
          .filter(t => { const d = new Date(t.transacted_at); return d.getFullYear() === year && d.getMonth() === month })
          .reduce((s, t) => s + Math.abs(t.amount), 0)
      )
      return { periods: ps, totals: tots, labels: ps.map(p => MONTH_ABBR[p.month].toUpperCase()) }
    } else {
      const years = [...new Set(transactions.map(t => new Date(t.transacted_at).getFullYear()))].sort() as number[]
      const ps = years.map(yr => ({ year: yr, month: -1 }))
      const tots = years.map(yr =>
        transactions
          .filter(t => new Date(t.transacted_at).getFullYear() === yr)
          .reduce((s, t) => s + Math.abs(t.amount), 0)
      )
      return { periods: ps, totals: tots, labels: years.map(yr => String(yr)) }
    }
  }, [view, transactions])

  const effectiveIdx = Math.min(selectedIdx ?? periods.length - 1, periods.length - 1)

  // ── Selected period transactions ─────────────────────────────────────────────
  const selectedPeriodTxns = useMemo(() => {
    const p = periods[effectiveIdx]
    if (!p) return []
    return transactions.filter(t => {
      const d = new Date(t.transacted_at)
      return view === 'yearly'
        ? d.getFullYear() === p.year
        : d.getFullYear() === p.year && d.getMonth() === p.month
    })
  }, [periods, effectiveIdx, transactions, view])

  const top10 = useMemo(() =>
    [...selectedPeriodTxns].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10),
    [selectedPeriodTxns]
  )

  // ── Stats ────────────────────────────────────────────────────────────────────
  const allTimeTotal = transactions.reduce((s, t) => s + Math.abs(t.amount), 0)
  const avgTxn = transactions.length > 0 ? allTimeTotal / transactions.length : 0
  const periodsWithData = totals.filter(v => v > 0)
  const avgPerPeriod = periodsWithData.length > 0
    ? periodsWithData.reduce((s, v) => s + v, 0) / periodsWithData.length
    : 0

  const selectedTotal = totals[effectiveIdx] ?? 0
  const selectedLabel = labels[effectiveIdx] ?? ''

  // ── Recent transactions (last 20) ────────────────────────────────────────────
  const recentTxns = useMemo(() =>
    [...transactions].sort((a, b) => b.transacted_at.localeCompare(a.transacted_at)).slice(0, 20),
    [transactions]
  )
  const grouped = useMemo(() => groupByDate(recentTxns), [recentTxns])

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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">{selectedLabel}</p>
            <p className="text-3xl font-bold text-gray-900">${fmt(selectedTotal)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-gray-400">{transactions.length} transactions total</p>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => handleSetView('monthly')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  view === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >Monthly</button>
              <button
                onClick={() => handleSetView('yearly')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  view === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >Yearly</button>
            </div>
          </div>
        </div>
        <div className="px-5 pb-4">
          <PeriodBarChart
            totals={totals}
            labels={labels}
            color={color}
            selectedIdx={effectiveIdx}
            onSelect={setSelectedIdx}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100" style={{ backgroundColor: color }}>
          <p className="text-sm font-bold text-white">Summary</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total (all time)</span>
            <span className="text-sm font-semibold text-gray-900">${fmt(allTimeTotal)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Avg per {view === 'yearly' ? 'year' : 'month'}</span>
            <span className="text-sm font-semibold text-gray-900">${fmt(avgPerPeriod)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Average transaction</span>
            <span className="text-sm font-semibold text-gray-900">${fmt(avgTxn)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total transactions</span>
            <span className="text-sm font-semibold text-gray-900">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Top 10 transactions for selected period */}
      {top10.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ backgroundColor: color }}>
            <p className="text-sm font-bold text-white">Top Transactions</p>
            <span className="text-sm text-white/70">{selectedLabel}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {top10.map(t => {
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
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.transacted_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {t.account_name && ` · ${t.account_name}`}
                    </p>
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
      )}

      {/* Recent Transactions (last 20) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ backgroundColor: color }}>
          <p className="text-sm font-bold text-white">Recent Transactions</p>
          <span className="text-sm text-white/70">
            {Math.min(transactions.length, 20)} of {transactions.length}
          </span>
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
