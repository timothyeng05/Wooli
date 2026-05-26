'use client'

import { useState, useMemo } from 'react'
import type { CashFlowTransaction, CashFlowCategory } from '@/app/budget/cashflow/page'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function CashFlowChart({
  months,
  selectedIdx,
  onSelect,
}: {
  months: { year: number; month: number; income: number; expenses: number; savings: number }[]
  selectedIdx: number
  onSelect: (i: number) => void
}) {
  const W = 320
  const H = 160
  const pad = { top: 12, bottom: 24, left: 8, right: 8 }
  const chartH = H - pad.top - pad.bottom
  const centerY = pad.top + chartH / 2
  const barH = chartH / 2 - 4
  const n = months.length
  const colW = (W - pad.left - pad.right) / n

  const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expenses)), 1)

  const barX = (i: number) => pad.left + i * colW + colW * 0.15
  const barW = colW * 0.7
  const r = 4

  // Savings line points
  const linePoints = months.map((m, i) => {
    const x = pad.left + i * colW + colW / 2
    const y = centerY - (m.savings / maxVal) * barH
    return { x, y }
  })
  const polyline = linePoints.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      {months.map((m, i) => {
        const x = barX(i)
        const selected = i === selectedIdx
        const iH = Math.max((m.income / maxVal) * barH, 2)
        const eH = Math.max((m.expenses / maxVal) * barH, 2)

        return (
          <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            {/* Income bar (up) */}
            <rect
              x={x} y={centerY - iH} width={barW} height={iH}
              rx={r} ry={r}
              fill={selected ? '#16a34a' : '#bbf7d0'}
            />
            {/* Expense bar (down) */}
            <rect
              x={x} y={centerY} width={barW} height={eH}
              rx={r} ry={r}
              fill={selected ? '#ef4444' : '#fecaca'}
            />
            {/* Month label */}
            <text
              x={x + barW / 2} y={H - 4}
              textAnchor="middle" fontSize="9"
              fill={selected ? '#111827' : '#9ca3af'}
              fontWeight={selected ? '700' : '400'}
            >
              {MONTH_LABELS[m.month].toUpperCase()}
            </text>
          </g>
        )
      })}
      {/* Savings line */}
      <polyline
        points={polyline}
        fill="none" stroke="#111827" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={months[selectedIdx]?.savings !== undefined ? undefined : '4 2'}
      />
      {/* Dot on selected month */}
      {linePoints[selectedIdx] && (
        <circle
          cx={linePoints[selectedIdx].x} cy={linePoints[selectedIdx].y}
          r={3} fill="#111827"
        />
      )}
    </svg>
  )
}

// ── Category / merchant breakdown row ─────────────────────────────────────────
function BreakdownRow({
  icon, name, amount, pct, isIncome,
}: {
  icon: string | null
  name: string
  amount: number
  pct: number
  isIncome: boolean
}) {
  const bg = isIncome ? 'bg-green-100' : 'bg-red-100'
  return (
    <div className="relative overflow-hidden rounded-xl px-3 py-2.5 mb-1.5">
      {/* Background bar */}
      <div
        className={`absolute inset-y-0 left-0 ${bg} rounded-xl`}
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-base leading-none flex-shrink-0">{icon}</span>}
          <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
        </div>
        <span className="text-sm font-semibold text-gray-700 flex-shrink-0 tabular-nums">
          ${fmt(amount)} <span className="text-xs font-normal text-gray-400">({pct.toFixed(1)}%)</span>
        </span>
      </div>
    </div>
  )
}

// ── Breakdown section ─────────────────────────────────────────────────────────
type BreakdownTab = 'Category' | 'Merchant'

function BreakdownSection({
  title,
  isIncome,
  transactions,
  categories,
}: {
  title: string
  isIncome: boolean
  transactions: CashFlowTransaction[]
  categories: CashFlowCategory[]
}) {
  const [tab, setTab] = useState<BreakdownTab>('Category')
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const rows = useMemo(() => {
    const totals = new Map<string, { icon: string | null; name: string; amount: number }>()
    let grandTotal = 0

    for (const t of transactions) {
      const amt = Math.abs(t.amount)
      grandTotal += amt

      if (tab === 'Category') {
        const cat = t.category
        let key = 'Uncategorized'
        let icon: string | null = null
        let name = 'Uncategorized'

        if (cat) {
          const parent = cat.parent_id ? catMap.get(cat.parent_id) : null
          const effective = parent ?? cat
          key = effective.id
          icon = effective.icon
          name = effective.name
        }

        const existing = totals.get(key)
        if (existing) existing.amount += amt
        else totals.set(key, { icon, name, amount: amt })
      } else {
        const key = t.merchant?.trim() || 'Unknown'
        const existing = totals.get(key)
        if (existing) existing.amount += amt
        else totals.set(key, { icon: null, name: key, amount: amt })
      }
    }

    return [...totals.values()]
      .sort((a, b) => b.amount - a.amount)
      .map(r => ({ ...r, pct: grandTotal > 0 ? (r.amount / grandTotal) * 100 : 0 }))
  }, [transactions, tab, catMap])

  if (transactions.length === 0) return null

  return (
    <div className="mt-6">
      <p className="text-base font-bold text-gray-900 mb-3">{title}</p>
      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        {(['Category', 'Merchant'] as BreakdownTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-gray-900 text-white'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div>
        {rows.map(r => (
          <BreakdownRow
            key={r.name}
            icon={r.icon}
            name={r.name}
            amount={r.amount}
            pct={r.pct}
            isIncome={isIncome}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CashFlowClient({
  transactions,
  categories,
  currentYear,
  currentMonth,
}: {
  transactions: CashFlowTransaction[]
  categories: CashFlowCategory[]
  currentYear: number
  currentMonth: number
}) {
  // Build the 6-month list
  const months = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return result
  }, [currentYear, currentMonth])

  const [selectedIdx, setSelectedIdx] = useState(months.length - 1)

  // Aggregate totals per month
  const monthlyTotals = useMemo(() => {
    return months.map(({ year, month }) => {
      let income = 0
      let expenses = 0
      for (const t of transactions) {
        if (t.is_transfer || t.category?.is_transfer) continue
        const d = new Date(t.transacted_at)
        if (d.getFullYear() !== year || d.getMonth() !== month) continue
        if (t.amount >= 0) income += t.amount
        else expenses += Math.abs(t.amount)
      }
      return { year, month, income, expenses, savings: income - expenses }
    })
  }, [transactions, months])

  const selected = monthlyTotals[selectedIdx]

  // Transactions for selected month
  const selectedTxns = useMemo(() => {
    return transactions.filter(t => {
      if (t.is_transfer || t.category?.is_transfer) return false
      const d = new Date(t.transacted_at)
      return d.getFullYear() === selected.year && d.getMonth() === selected.month
    })
  }, [transactions, selected])

  const incomeTxns = selectedTxns.filter(t => t.category ? t.category.is_income : t.amount >= 0)
  const expenseTxns = selectedTxns.filter(t => t.category ? !t.category.is_income : t.amount < 0)

  const monthLabel = `${MONTH_LABELS[selected.month]} ${selected.year}`

  return (
    <div>
      {/* Chart */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <CashFlowChart
          months={monthlyTotals}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>

      {/* Month summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-2">
        <p className="text-lg font-bold text-gray-900 mb-3">{monthLabel}</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-sm text-gray-700">Income</span>
            </div>
            <span className="text-sm font-semibold text-green-600">${fmt(selected.income)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-sm text-gray-700">Expenses</span>
            </div>
            <span className="text-sm font-semibold text-red-500">${fmt(selected.expenses)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-800 flex-shrink-0" />
              <span className="text-sm text-gray-700">Savings</span>
            </div>
            <span className={`text-sm font-semibold ${selected.savings >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
              {selected.savings < 0 ? '-' : ''}${fmt(Math.abs(selected.savings))}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <BreakdownSection
        title="Income"
        isIncome={true}
        transactions={incomeTxns}
        categories={categories}
      />
      <BreakdownSection
        title="Expenses"
        isIncome={false}
        transactions={expenseTxns}
        categories={categories}
      />
    </div>
  )
}
