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

// ── Owner breakdown ───────────────────────────────────────────────────────────
const OWNER_DISPLAY: Record<string, string> = {
  'Timothy Eng': 'Tim',
  'Jessica Li': 'Jess',
  'Shared': 'Shared',
}
const OWNER_COLORS: Record<string, string> = {
  'Timothy Eng': '#3b82f6',
  'Jessica Li': '#f43f5e',
  'Shared': '#8b5cf6',
}

function OwnerBreakdown({ transactions }: { transactions: CashFlowTransaction[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { expenses: number; income: number }>()
    for (const t of transactions) {
      const key = t.owner ?? 'Unknown'
      const entry = map.get(key) ?? { expenses: 0, income: 0 }
      if (t.amount < 0) entry.expenses += Math.abs(t.amount)
      else entry.income += t.amount
      map.set(key, entry)
    }
    const order = ['Timothy Eng', 'Jessica Li', 'Shared']
    return [...map.entries()]
      .sort((a, b) => (order.indexOf(a[0]) ?? 99) - (order.indexOf(b[0]) ?? 99))
      .filter(([, v]) => v.expenses > 0 || v.income > 0)
  }, [transactions])

  if (rows.length === 0) return null

  const maxExpense = Math.max(...rows.map(([, v]) => v.expenses), 1)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mt-2">
      <p className="text-sm font-bold text-gray-900 mb-3">By Person</p>
      <div className="space-y-3">
        {rows.map(([owner, { expenses, income }]) => {
          const label = OWNER_DISPLAY[owner] ?? owner
          const color = OWNER_COLORS[owner] ?? '#6b7280'
          return (
            <div key={owner}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  {income > 0 && <span className="text-green-600">+${fmt(income)}</span>}
                  <span className="text-gray-700 font-semibold">-${fmt(expenses)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(expenses / maxExpense) * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Category trends ───────────────────────────────────────────────────────────
function CategoryTrends({
  transactions,
  months,
  categories,
}: {
  transactions: CashFlowTransaction[]
  months: { year: number; month: number }[]
  categories: CashFlowCategory[]
}) {
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; color: string; monthly: number[] }>()

    for (let i = 0; i < months.length; i++) {
      const { year, month } = months[i]
      for (const t of transactions) {
        if (t.is_transfer || t.category?.is_transfer) continue
        if (t.amount >= 0) continue
        const d = new Date(t.transacted_at)
        if (d.getFullYear() !== year || d.getMonth() !== month) continue

        const cat = t.category
        const parent = cat?.parent_id ? catMap.get(cat.parent_id) : null
        const effective = parent ?? cat
        const key = effective?.id ?? 'uncategorized'
        const name = effective?.name ?? 'Uncategorized'
        const color = effective?.color ?? '#6b7280'

        if (!map.has(key)) map.set(key, { name, color, monthly: new Array(months.length).fill(0) })
        map.get(key)!.monthly[i] += Math.abs(t.amount)
      }
    }

    return [...map.values()]
      .filter(r => r.monthly.some(v => v > 0))
      .sort((a, b) => b.monthly.reduce((s, v) => s + v, 0) - a.monthly.reduce((s, v) => s + v, 0))
      .slice(0, 10)
  }, [transactions, months, catMap])

  if (rows.length === 0) return null

  return (
    <div className="mt-6">
      <p className="text-base font-bold text-gray-900 mb-4">Spending Trends</p>
      <div className="space-y-4">
        {rows.map(row => {
          const max = Math.max(...row.monthly, 1)
          const avg = row.monthly.reduce((s, v) => s + v, 0) / months.length
          return (
            <div key={row.name}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-sm font-medium text-gray-800">{row.name}</span>
                </div>
                <span className="text-xs text-gray-400">${fmt(avg)}/mo avg</span>
              </div>
              <div className="flex items-end gap-1">
                {row.monthly.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-t-sm" style={{
                      height: 28,
                      background: v > 0
                        ? `linear-gradient(to top, ${row.color}cc, ${row.color}66)`
                        : '#f3f4f6',
                      clipPath: v > 0
                        ? `inset(${100 - Math.max((v / max) * 100, 6)}% 0 0 0)`
                        : undefined,
                    }} />
                    <span className="text-[9px] text-gray-400">{MONTH_LABELS[months[i].month].toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
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

      {/* Owner breakdown */}
      <OwnerBreakdown transactions={selectedTxns} />

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

      {/* Category trends across all 6 months */}
      <CategoryTrends
        transactions={transactions}
        months={months}
        categories={categories}
      />
    </div>
  )
}
