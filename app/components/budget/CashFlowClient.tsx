'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import type { CashFlowTransaction, CashFlowCategory } from '@/app/budget/cashflow/page'
import type { HouseholdMember } from './transaction-types'
import { createClient } from '@/lib/supabase-client'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── Setup checklist CTA ───────────────────────────────────────────────────────
const CTA_ITEMS = [
  {
    key: 'goals',
    icon: '🎯',
    title: 'Set a savings goal',
    description: 'Define what you\'re saving for — vacation, emergency fund, a big purchase — and track progress.',
    href: '/budget/goals',
  },
]

// Per-user CTA: dismissal lives on profiles.setup_cta_dismissed (server-side) so it
// never leaks across users on a shared browser, and only new / freshly-reset accounts
// (whose map is still empty) ever see it.
function SetupChecklist({ userId, initialDismissed }: { userId: string; initialDismissed: Record<string, boolean> }) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(initialDismissed)

  const dismiss = (key: string) => {
    const next = { ...dismissed, [key]: true }
    setDismissed(next)
    createClient().from('profiles').update({ setup_cta_dismissed: next }).eq('id', userId)
      .then(({ error }) => { if (error) console.error('Failed to save CTA dismissal', error) })
  }

  const visible = CTA_ITEMS.filter(item => !dismissed[item.key])
  if (visible.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
      <p className="text-sm font-bold text-gray-900 mb-3">Next steps</p>
      <div className="space-y-2">
        {visible.map(item => (
          <div key={item.key} className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <a href={item.href} className="text-sm font-semibold text-gray-800 hover:text-blue-700 transition">
                {item.title} →
              </a>
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            </div>
            <button
              onClick={() => dismiss(item.key)}
              title="Dismiss"
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-green-50 hover:text-green-500 transition mt-0.5"
            >
              ✓
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtShort(n: number): string {
  if (n >= 10000) return `$${Math.round(n / 1000)}k`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function CashFlowChart({
  months,
  selectedIdx,
  onSelect,
}: {
  months: { year: number; month: number; income: number; expenses: number; savings: number; label?: string }[]
  selectedIdx: number
  onSelect: (i: number) => void
}) {
  // The viewBox aspect has to track the rendered box (roughly 1100×180 on
  // desktop). At 320×160 the default preserveAspectRatio="meet" scaled the
  // chart to fit the *height* and centred it, so six bars sat in a ~360px
  // island with ~370px of dead space either side.
  const W = 1000
  const H = 160
  const pad = { top: 12, bottom: 24, left: 8, right: 8 }
  const chartH = H - pad.top - pad.bottom
  const centerY = pad.top + chartH / 2
  const barH = chartH / 2 - 4
  const n = months.length
  const colW = (W - pad.left - pad.right) / n

  const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expenses)), 1)

  // Half-column bars, centred in their slot — at full width a 0.7 fill reads as
  // slabs rather than marks.
  const barX = (i: number) => pad.left + i * colW + colW * 0.25
  const barW = colW * 0.5
  const r = 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      {months.map((m, i) => {
        const x = barX(i)
        const selected = i === selectedIdx
        const iH = Math.max((m.income / maxVal) * barH, 2)
        const eH = Math.max((m.expenses / maxVal) * barH, 2)

        return (
          <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            {/* Full-column invisible tap target for mobile */}
            <rect x={x} y={0} width={barW} height={H} fill="transparent" />
            {/* Income bar (up) */}
            <rect x={x} y={centerY - iH} width={barW} height={iH} rx={r} ry={r}
              fill={selected ? '#16a34a' : '#bbf7d0'} />
            {/* Income $ label */}
            {iH >= 20 && (
              <text x={x + barW / 2} y={centerY - iH / 2 + 4}
                textAnchor="middle" fontSize="13" fontWeight="700"
                fill={selected ? 'white' : '#166534'}>
                {fmtShort(m.income)}
              </text>
            )}
            {/* Expense bar (down) */}
            <rect x={x} y={centerY} width={barW} height={eH} rx={r} ry={r}
              fill={selected ? '#ef4444' : '#fecaca'} />
            {/* Expense $ label */}
            {eH >= 20 && (
              <text x={x + barW / 2} y={centerY + eH / 2 + 4}
                textAnchor="middle" fontSize="13" fontWeight="700"
                fill={selected ? 'white' : '#991b1b'}>
                {fmtShort(m.expenses)}
              </text>
            )}
            {/* Month label */}
            <text x={x + barW / 2} y={H - 4}
              textAnchor="middle" fontSize="12"
              fill={selected ? '#111827' : '#9ca3af'}
              fontWeight={selected ? '700' : '400'}>
              {m.label ?? MONTH_LABELS[m.month].toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, isIncome }: { values: number[]; isIncome: boolean }) {
  const W = 48, H = 14
  const nonZero = values.filter(v => v > 0)
  if (nonZero.length < 2) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
        <line x1={0} y1={H / 2} x2={W} y2={H / 2}
          stroke="#d1d5db" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    )
  }
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * W).toFixed(1)
    const y = (H - 2 - (v / max) * (H - 4)).toFixed(1)
    return `${x},${y}`
  }).join(' ')
  const first = nonZero[0]
  const last = values[values.length - 1]
  const up = last >= first
  const color = isIncome ? (up ? '#22c55e' : '#ef4444') : (up ? '#ef4444' : '#22c55e')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Category / merchant breakdown row ─────────────────────────────────────────
function BreakdownRow({
  icon, name, amount, pct, isIncome, href, sparkVals,
}: {
  icon: string | null
  name: string
  amount: number
  pct: number
  isIncome: boolean
  href?: string
  sparkVals?: number[]
}) {
  const bg = isIncome ? 'bg-green-100' : 'bg-red-100'
  const inner = (
    <div className={`relative overflow-hidden rounded-xl px-3 py-2.5 mb-1.5 ${href ? 'hover:brightness-95 transition-all' : ''}`}>
      <div className={`absolute inset-y-0 left-0 ${bg} rounded-xl`} style={{ width: `${Math.max(pct, 3)}%` }} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-base leading-none flex-shrink-0">{icon}</span>}
          <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {sparkVals !== undefined && <Sparkline values={sparkVals} isIncome={isIncome} />}
          <span className="text-sm font-semibold text-gray-700 tabular-nums">
            ${fmt(amount)} <span className="text-xs font-normal text-gray-400">({Math.round(pct)}%)</span>
          </span>
          {href && <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>}
        </div>
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Breakdown section ─────────────────────────────────────────────────────────
type BreakdownTab = 'Category' | 'Merchant'

function BreakdownSection({
  title, isIncome, transactions, categories, allTransactions, periods, periodicMode,
}: {
  title: string
  isIncome: boolean
  transactions: CashFlowTransaction[]
  categories: CashFlowCategory[]
  allTransactions?: CashFlowTransaction[]
  periods?: { year: number; month: number }[]
  periodicMode?: 'monthly' | 'yearly'
}) {
  const [tab, setTab] = useState<BreakdownTab>('Category')
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // Sparkline data: catId or merchant name → monthly values
  const sparklines = useMemo(() => {
    if (!allTransactions || !periods || periods.length < 2) return null
    const n = periods.length
    const byId = new Map<string, number[]>()
    const byMerchant = new Map<string, number[]>()
    // Filter to same income/expense type
    const filtered = allTransactions.filter(t => {
      if (t.is_transfer || t.category?.is_transfer) return false
      return isIncome
        ? (t.category ? t.category.is_income : t.amount >= 0)
        : (t.category ? !t.category.is_income : t.amount < 0)
    })
    for (const t of filtered) {
      const d = new Date(t.transacted_at)
      let pi = -1
      for (let i = 0; i < n; i++) {
        const { year, month } = periods[i]
        const match = periodicMode === 'yearly'
          ? d.getFullYear() === year
          : d.getFullYear() === year && d.getMonth() === month
        if (match) { pi = i; break }
      }
      if (pi < 0) continue
      // Income sections take the amount as-is; expense sections take -amount so a
      // credit filed against an expense category nets down that category.
      const amt = isIncome ? t.amount : -t.amount
      const cat = t.category
      if (cat) {
        const parent = cat.parent_id ? catMap.get(cat.parent_id) : null
        const topId = (parent ?? cat).id
        if (!byId.has(topId)) byId.set(topId, new Array(n).fill(0))
        byId.get(topId)![pi] += amt
        if (cat.parent_id) {
          if (!byId.has(cat.id)) byId.set(cat.id, new Array(n).fill(0))
          byId.get(cat.id)![pi] += amt
        }
      }
      const mk = t.merchant?.trim() || 'Unknown'
      if (!byMerchant.has(mk)) byMerchant.set(mk, new Array(n).fill(0))
      byMerchant.get(mk)![pi] += amt
    }
    return { byId, byMerchant }
  }, [allTransactions, periods, periodicMode, isIncome, catMap])

  const rows = useMemo(() => {
    type SubEntry = { id: string; name: string; icon: string | null; amount: number }
    type RowEntry = { icon: string | null; name: string; amount: number; catId: string | null; subMap: Map<string, SubEntry> }
    const totals = new Map<string, RowEntry>()
    let grandTotal = 0

    if (transactions.length > 0) {
      for (const t of transactions) {
        const amt = isIncome ? t.amount : -t.amount
        grandTotal += amt
        if (tab === 'Category') {
          const cat = t.category
          let key = 'Uncategorized', icon: string | null = null, name = 'Uncategorized', catId: string | null = null
          if (cat) {
            const parent = cat.parent_id ? catMap.get(cat.parent_id) : null
            const effective = parent ?? cat
            key = effective.id; icon = effective.icon; name = effective.name; catId = effective.id
          }
          if (!totals.has(key)) totals.set(key, { icon, name, amount: 0, catId, subMap: new Map() })
          const row = totals.get(key)!
          row.amount += amt
          if (cat && cat.parent_id) {
            if (!row.subMap.has(cat.id)) row.subMap.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon, amount: 0 })
            row.subMap.get(cat.id)!.amount += amt
          }
        } else {
          const key = t.merchant?.trim() || 'Unknown'
          if (!totals.has(key)) totals.set(key, { icon: null, name: key, amount: 0, catId: null, subMap: new Map() })
          totals.get(key)!.amount += amt
        }
      }
    } else if (tab === 'Category') {
      // No transactions — fall back to showing all categories at $0
      for (const cat of categories.filter(c => !c.parent_id && (isIncome ? c.is_income : !c.is_income && !c.is_transfer))) {
        const subMap = new Map<string, SubEntry>()
        for (const sub of categories.filter(c => c.parent_id === cat.id)) {
          subMap.set(sub.id, { id: sub.id, name: sub.name, icon: sub.icon, amount: 0 })
        }
        totals.set(cat.id, { icon: cat.icon, name: cat.name, amount: 0, catId: cat.id, subMap })
      }
    }

    return [...totals.values()]
      .sort((a, b) => b.amount - a.amount)
      .map(r => ({
        icon: r.icon, name: r.name, amount: r.amount, catId: r.catId,
        pct: grandTotal > 0 ? (r.amount / grandTotal) * 100 : 0,
        subs: [...r.subMap.values()].sort((a, b) => b.amount - a.amount),
      }))
  }, [transactions, tab, catMap, categories, isIncome])

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className="text-sm font-bold text-gray-900 mb-3">{title}</p>
      <div className="flex gap-2 mb-3">
        {(['Category', 'Merchant'] as BreakdownTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation ${
              tab === t ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
            }`}>{t}</button>
        ))}
      </div>
      <div>
        {rows.map(r => {
          const sparkVals = sparklines
            ? (tab === 'Category'
              ? (r.catId ? (sparklines.byId.get(r.catId) ?? []) : [])
              : (sparklines.byMerchant.get(r.name) ?? []))
            : undefined
          return (
            <div key={r.name}>
              <BreakdownRow
                icon={r.icon} name={r.name} amount={r.amount} pct={r.pct}
                isIncome={isIncome}
                href={tab === 'Category' && r.catId ? `/budget/categories/${r.catId}` : undefined}
                sparkVals={sparkVals}
              />
              {tab === 'Category' && r.subs.length > 0 && (
                <div className="ml-3 mb-1.5 space-y-px">
                  {r.subs.map(sub => {
                    const subSpark = sparklines ? (sparklines.byId.get(sub.id) ?? []) : undefined
                    return (
                      <Link key={sub.id} href={`/budget/categories/${sub.id}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition group">
                        <div className="flex items-center gap-2 min-w-0">
                          {sub.icon && <span className="text-sm flex-shrink-0">{sub.icon}</span>}
                          <span className="text-sm text-gray-600 truncate">{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {subSpark !== undefined && <Sparkline values={subSpark} isIncome={isIncome} />}
                          <span className="text-sm font-medium text-gray-500 tabular-nums">${fmt(sub.amount)}</span>
                          <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Category trends (stacked bar chart) ──────────────────────────────────────
function CategoryTrends({
  transactions,
  months,
  categories,
  selectedIdx,
  onSelect,
  periodicMode,
}: {
  transactions: CashFlowTransaction[]
  months: { year: number; month: number }[]
  categories: CashFlowCategory[]
  selectedIdx: number
  onSelect: (i: number) => void
  periodicMode: 'monthly' | 'yearly'
}) {
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const data = useMemo(() => {
    const map = new Map<string, { name: string; color: string; catId: string; monthly: number[] }>()
    for (let i = 0; i < months.length; i++) {
      const { year, month } = months[i]
      for (const t of transactions) {
        if (t.is_transfer || t.category?.is_transfer) continue
        // Drop income-category rows, not every positive amount — a positive row in
        // an expense category is a credit against it and must still be counted.
        if (t.category ? t.category.is_income : t.amount >= 0) continue
        const d = new Date(t.transacted_at)
        if (periodicMode === 'yearly' ? d.getFullYear() !== year : (d.getFullYear() !== year || d.getMonth() !== month)) continue
        const cat = t.category
        const parent = cat?.parent_id ? catMap.get(cat.parent_id) : null
        const effective = parent ?? cat
        const key = effective?.id ?? 'uncategorized'
        if (!map.has(key)) map.set(key, {
          name: effective?.name ?? 'Uncategorized',
          color: effective?.color ?? '#6b7280',
          catId: effective?.id ?? '',
          monthly: new Array(months.length).fill(0),
        })
        map.get(key)!.monthly[i] += -t.amount
      }
    }
    return [...map.values()]
      .filter(r => r.monthly.some(v => v > 0))
      .sort((a, b) => b.monthly.reduce((s, v) => s + v, 0) - a.monthly.reduce((s, v) => s + v, 0))
      .slice(0, 8)
  }, [transactions, months, catMap])

  const monthlyTotals = useMemo(
    () => months.map((_, i) => data.reduce((s, r) => s + r.monthly[i], 0)),
    [data, months]
  )

  const selectedBreakdown = useMemo(() => {
    const total = monthlyTotals[selectedIdx]
    return data
      .filter(r => r.monthly[selectedIdx] > 0)
      .map(r => ({ ...r, amount: r.monthly[selectedIdx], pct: total > 0 ? (r.monthly[selectedIdx] / total) * 100 : 0 }))
  }, [data, selectedIdx, monthlyTotals])

  // Same aspect-ratio fix as IncomeExpenseChart above — see the note there.
  const W = 1000
  const H = 160
  const pad = { top: 20, bottom: 24, left: 8, right: 8 }
  const chartH = H - pad.top - pad.bottom
  const bottomY = pad.top + chartH
  const maxVal = Math.max(...monthlyTotals, 1)
  const n = months.length
  const colW = (W - pad.left - pad.right) / n
  const barW = colW * 0.5

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <p className="text-sm font-bold text-gray-900">Spending Trends</p>
      </div>

      <div className="bg-gray-50 pt-2 pb-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
          {months.map((m, i) => {
            const total = monthlyTotals[i]
            const totalBarH = total > 0 ? (total / maxVal) * chartH : 0
            const barX = pad.left + i * colW + colW * 0.25
            const selected = i === selectedIdx

            // Pre-compute segment positions for this month
            let cy = bottomY
            const segs = [...data].reverse().map(cat => {
              const segH = total > 0 ? (cat.monthly[i] / maxVal) * chartH : 0
              const show = segH >= 0.5
              const segY = cy - segH
              if (show) cy -= segH
              return { cat, segH, segY, show }
            })

            return (
              <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
                {/* Full-column invisible tap target for mobile */}
                <rect x={barX} y={0} width={barW} height={H} fill="transparent" />
                {segs.map(({ cat, segH, segY, show }, ci) => {
                  if (!show) return null
                  const pct = total > 0 ? (cat.monthly[i] / total) * 100 : 0
                  const segCY = segY + segH / 2
                  return (
                    <g key={cat.catId || ci}>
                      <rect x={barX} y={segY} width={barW} height={segH}
                        fill={cat.color} opacity={selected ? 1 : 0.45} rx={2} ry={2} />
                    </g>
                  )
                })}
                {/* Total above every bar */}
                {total > 0 && totalBarH >= 8 && (
                  <text x={barX + barW / 2} y={bottomY - totalBarH - 5}
                    textAnchor="middle" fontSize={selected ? '13' : '12'}
                    fill={selected ? '#111827' : '#9ca3af'}
                    fontWeight={selected ? '700' : '500'}>
                    {fmtShort(total)}
                  </text>
                )}
                {/* Month label */}
                <text x={barX + barW / 2} y={H - 4}
                  textAnchor="middle" fontSize="12"
                  fill={selected ? '#111827' : '#9ca3af'}
                  fontWeight={selected ? '700' : '400'}>
                  {periodicMode === 'yearly' ? String(m.year) : MONTH_LABELS[m.month].toUpperCase()}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Category breakdown for selected month */}
      <div className="px-5 pt-3 pb-4 space-y-0.5">
        {data.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No expense data yet</p>
        )}
        {selectedBreakdown.map(r => (
          <Link
            key={r.catId || r.name}
            href={r.catId ? `/budget/categories/${r.catId}` : '#'}
            className="relative overflow-hidden rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 hover:brightness-95 transition-all"
          >
            <div className="absolute inset-y-0 left-0 rounded-xl"
              style={{ width: `${Math.max(r.pct, 3)}%`, backgroundColor: `${r.color}33` }} />
            <div className="relative flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
              <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
            </div>
            <div className="relative flex items-center gap-1.5 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-700 tabular-nums">
                ${fmt(r.amount)} <span className="text-xs font-normal text-gray-400">({Math.round(r.pct)}%)</span>
              </span>
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CashFlowClient({
  transactions,
  categories,
  members = [],
  currentYear,
  currentMonth,
  userId,
  setupCtaDismissed = {},
}: {
  transactions: CashFlowTransaction[]
  categories: CashFlowCategory[]
  members?: HouseholdMember[]
  currentYear: number
  currentMonth: number
  userId: string
  setupCtaDismissed?: Record<string, boolean>
}) {
  // ── View toggle ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly')
  const [yearlyTxns, setYearlyTxns] = useState<CashFlowTransaction[] | null>(null)
  const [yearlyLoading, setYearlyLoading] = useState(false)

  // ── Owner filter ──────────────────────────────────────────────────────────
  // null = every owner. Filters every chart on the page, not just the
  // now-removed "Spending by Person" cards this replaced.
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const filteredTransactions = useMemo(
    () => ownerFilter ? transactions.filter(t => t.owner === ownerFilter) : transactions,
    [transactions, ownerFilter]
  )
  const filteredYearlyTxns = useMemo(
    () => !yearlyTxns ? null : (ownerFilter ? yearlyTxns.filter(t => t.owner === ownerFilter) : yearlyTxns),
    [yearlyTxns, ownerFilter]
  )

  // ── Monthly periods (6 months) ────────────────────────────────────────────
  const monthlyPeriods = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return result
  }, [currentYear, currentMonth])

  const monthlyTotals = useMemo(() => {
    return monthlyPeriods.map(({ year, month }) => {
      let income = 0, expenses = 0
      for (const t of filteredTransactions) {
        if (t.is_transfer || t.category?.is_transfer) continue
        const d = new Date(t.transacted_at)
        if (d.getFullYear() !== year || d.getMonth() !== month) continue
        // Category decides the bucket; the sign decides the direction within it.
        if (t.category ? !t.category.is_income : t.amount < 0) expenses += -t.amount
        else income += t.amount
      }
      return { year, month, income, expenses, savings: income - expenses }
    })
  }, [filteredTransactions, monthlyPeriods])

  // ── Yearly periods (derived from fetched data) ────────────────────────────
  const yearlyData = useMemo(() => {
    if (!filteredYearlyTxns) return { periods: [] as { year: number; month: number }[], totals: [] as { year: number; month: number; income: number; expenses: number; savings: number; label: string }[] }
    const years = [...new Set(filteredYearlyTxns.map(t => new Date(t.transacted_at).getFullYear()))].sort() as number[]
    const periods = years.map(yr => ({ year: yr, month: 0 }))
    const totals = years.map(yr => {
      let income = 0, expenses = 0
      for (const t of filteredYearlyTxns) {
        if (t.is_transfer || t.category?.is_transfer) continue
        const d = new Date(t.transacted_at)
        if (d.getFullYear() !== yr) continue
        if (t.category ? !t.category.is_income : t.amount < 0) expenses += -t.amount
        else income += t.amount
      }
      return { year: yr, month: 0, income, expenses, savings: income - expenses, label: String(yr) }
    })
    return { periods, totals }
  }, [filteredYearlyTxns])

  // ── Active data ───────────────────────────────────────────────────────────
  const activePeriods = view === 'monthly' ? monthlyPeriods : yearlyData.periods
  const activeTotals  = view === 'monthly' ? monthlyTotals  : yearlyData.totals
  const activeTxns    = view === 'monthly' ? filteredTransactions : (filteredYearlyTxns ?? [])

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(monthlyPeriods.length - 1)
  const [selectedYearIdx,  setSelectedYearIdx]  = useState(0)

  useEffect(() => {
    if (yearlyData.totals.length > 0) setSelectedYearIdx(yearlyData.totals.length - 1)
  }, [yearlyData.totals.length])

  const selectedIdx = view === 'monthly' ? selectedMonthIdx : selectedYearIdx
  const handleSelect = (i: number) => {
    if (view === 'monthly') setSelectedMonthIdx(i)
    else setSelectedYearIdx(i)
  }

  const selected = activeTotals[selectedIdx] ?? activeTotals[0]

  const selectedTxns = useMemo(() => {
    if (!selected) return []
    return activeTxns.filter(t => {
      if (t.is_transfer || t.category?.is_transfer) return false
      const d = new Date(t.transacted_at)
      return view === 'yearly'
        ? d.getFullYear() === selected.year
        : d.getFullYear() === selected.year && d.getMonth() === selected.month
    })
  }, [activeTxns, selected, view])

  const incomeTxns  = selectedTxns.filter(t => t.category ? t.category.is_income  : t.amount >= 0)
  const expenseTxns = selectedTxns.filter(t => t.category ? !t.category.is_income : t.amount < 0)

  // ── Yearly fetch ──────────────────────────────────────────────────────────
  const handleSwitchToYearly = async () => {
    setView('yearly')
    if (yearlyTxns || yearlyLoading) return
    setYearlyLoading(true)
    const supabase = createClient()
    const PAGE = 1000
    const all: CashFlowTransaction[] = []
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from('transactions')
        .select('id, amount, merchant, transacted_at, is_transfer, owner, categories(id, name, color, icon, is_income, is_transfer, parent_id)')
        // Hidden transactions are excluded from every reporting surface.
        .eq('is_hidden', false)
        .order('transacted_at', { ascending: false })
        .range(page * PAGE, (page + 1) * PAGE - 1) as any
      if (!data || data.length === 0) break
      all.push(...data.map((t: any) => ({
        id: t.id,
        amount: Number(t.amount),
        merchant: t.merchant ?? null,
        transacted_at: t.transacted_at,
        is_transfer: t.is_transfer ?? false,
        owner: t.owner ?? null,
        category: t.categories ?? null,
      })))
      if (data.length < PAGE) break
    }
    setYearlyTxns(all)
    setYearlyLoading(false)
  }

  const periodLabel = selected
    ? view === 'yearly'
      ? String(selected.year)
      : `${MONTH_LABELS[selected.month]} ${selected.year}`
    : ''

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-base font-bold text-gray-900">{periodLabel}</p>
        <div className="flex bg-gray-100 rounded-xl p-0.5">
          <button
            onClick={() => setView('monthly')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition touch-manipulation ${
              view === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={handleSwitchToYearly}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition touch-manipulation ${
              view === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {yearlyLoading ? 'Loading…' : 'Yearly'}
          </button>
        </div>
      </div>

      {/* Owner filter */}
      {members.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setOwnerFilter(null)}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border transition touch-manipulation ${
              ownerFilter === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            All
          </button>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setOwnerFilter(m.full_name)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition touch-manipulation ${
                ownerFilter === m.full_name
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
              style={ownerFilter === m.full_name ? { backgroundColor: m.color } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Setup checklist */}
      <SetupChecklist userId={userId} initialDismissed={setupCtaDismissed} />

      {/* Income vs Expenses */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
        <div className="px-5 pt-4 pb-1">
          <p className="text-sm font-bold text-gray-900">Income vs Expenses</p>
        </div>
        <div className="bg-gray-50 pt-2 pb-3">
          <CashFlowChart
            months={activeTotals}
            selectedIdx={selectedIdx}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Spending Trends */}
      <CategoryTrends
        transactions={activeTxns}
        months={activePeriods}
        categories={categories}
        selectedIdx={selectedIdx}
        onSelect={handleSelect}
        periodicMode={view}
      />

      {/* Breakdowns */}
      <BreakdownSection title="Income"   isIncome={true}  transactions={incomeTxns}  categories={categories}
        allTransactions={filteredTransactions} periods={monthlyPeriods} periodicMode="monthly" />
      <BreakdownSection title="Expenses" isIncome={false} transactions={expenseTxns} categories={categories}
        allTransactions={filteredTransactions} periods={monthlyPeriods} periodicMode="monthly" />
    </div>
  )
}
