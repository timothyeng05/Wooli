'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { getCatEmoji } from './catEmoji'

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function dateStr(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function startOfWeek(d: Date) { return addDays(d, -d.getDay()) }

// ── Net worth period picker (same options as the Accounts page) ────────────
const YTD = -1
const NW_PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'YTD', days: YTD },
  { label: '1Y', days: 365 },
  { label: 'All', days: Infinity },
]
function cutoffForPeriod(period: number): string | null {
  if (period === Infinity) return null
  if (period === YTD) return dateStr(new Date(new Date().getFullYear(), 0, 1))
  return dateStr(new Date(Date.now() - period * 86400000))
}

// ── Budget progress row ────────────────────────────────────────────────────
function ProgressRow({ label, planned, actual, barColor }: { label: string; planned: number; actual: number; barColor: string }) {
  const isIncome = label === 'Income'
  const hasTarget = planned > 0
  const pct = hasTarget ? Math.min(100, (actual / planned) * 100) : 0
  const remaining = planned - actual
  // For Income, exceeding the target is good (green); for Expenses it's bad (red over).
  const remainingGood = isIncome ? actual >= planned : remaining >= 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">{hasTarget ? `$${fmt(planned)} planned` : 'No target set'}</span>
      </div>
      {hasTarget && (
        <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5 overflow-hidden">
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">${fmt(actual)} {isIncome ? 'earned' : 'spent'}</span>
        {hasTarget && (
          <span className={remainingGood ? (isIncome ? 'text-green-600 font-medium' : 'text-gray-500') : 'text-red-500 font-medium'}>
            {isIncome
              ? (remainingGood ? `$${fmt(Math.abs(remaining))} over target` : `$${fmt(Math.abs(remaining))} short`)
              : (remaining >= 0 ? `$${fmt(remaining)} remaining` : `$${fmt(remaining)} over`)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Compact net worth chart ─────────────────────────────────────────────────
function MiniNetWorthChart({ series }: { series: { date: string; value: number }[] }) {
  if (series.length < 2) {
    return <div className="h-24 flex items-center justify-center text-xs text-gray-400">Not enough history yet</div>
  }
  const CW = 400, CH = 100
  const vals = series.map(p => p.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || Math.abs(max) * 0.05 || 1
  const pad = range * 0.15
  const minV = min - pad, maxV = max + pad
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * CW
    const y = CH - ((p.value - minV) / (maxV - minV)) * CH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const trendUp = series[series.length - 1].value >= series[0].value
  return (
    // h-32 rather than h-24: at 96px a 120-point series compressed slope changes
    // into near-flat noise. More vertical resolution is what makes a sparkline
    // readable, and it also evens out the two dashboard columns.
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-32" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={trendUp ? '#3b82f6' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ── Spending comparison chart (variable-length series: week/month/year modes) ──
// `curLength` truncates the "this period" line at today — the rest of the
// period hasn't happened yet, so it shouldn't draw as a flat line forward.
function SpendingCompareChart({ cur, prev, curLength }: { cur: number[]; prev: number[]; curLength: number }) {
  const n = Math.max(cur.length, prev.length, 2)
  const max = Math.max(...cur, ...prev, 1)
  const CW = 400, CH = 120
  const xAt = (i: number) => (i / (n - 1)) * CW
  const yAt = (v: number) => CH - (v / max) * CH
  const pointsFor = (vals: number[]) => vals.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')

  const curTrimmed = cur.slice(0, Math.max(2, curLength))
  const curLine = pointsFor(curTrimmed)
  // <path d> needs proper M/L commands — <polyline points> (used for curLine above)
  // is a different, simpler format that isn't valid here.
  const curPath = curTrimmed.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  const curArea = `${curPath} L${xAt(curTrimmed.length - 1).toFixed(1)},${CH} L0,${CH} Z`

  // Where the current period stops — early in a month this is a short stub next
  // to a full-width comparison line, which reads as a broken chart unless the
  // cutoff is marked. A vertical rule survives preserveAspectRatio="none"
  // undistorted (circles and text would not).
  const todayX = xAt(curTrimmed.length - 1)

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-40" preserveAspectRatio="none">
      {/* gray-400, not gray-300: the comparison series is data, not grid furniture,
          and at gray-300 it was barely visible on white. */}
      <polyline points={pointsFor(prev)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={curArea} fill="#f97316" fillOpacity="0.25" stroke="none" />
      <polyline points={curLine} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <line x1={todayX} y1="0" x2={todayX} y2={CH} stroke="#f97316" strokeWidth="1" strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke" opacity="0.5" />
    </svg>
  )
}

type CompareMode = 'week' | 'month' | 'month-vs-year' | 'month-vs-avg' | 'year'
const COMPARE_OPTIONS: { value: CompareMode; label: string }[] = [
  { value: 'week', label: 'This week vs. last week' },
  { value: 'month', label: 'This month vs. last month' },
  { value: 'month-vs-year', label: 'This month vs. last year' },
  { value: 'month-vs-avg', label: 'This month vs. average month' },
  { value: 'year', label: 'This year vs. last year' },
]

function computeCompareSeries(mode: CompareMode, dailyExpense: Record<string, number>) {
  const today = new Date()
  const dailyFrom = (start: Date, days: number) =>
    Array.from({ length: days }, (_, i) => dailyExpense[dateStr(addDays(start, i))] ?? 0)
  const cumulative = (vals: number[]) => {
    let running = 0
    return vals.map(v => { running += v; return running })
  }

  if (mode === 'week') {
    const thisStart = startOfWeek(today)
    return {
      curLabel: 'This week', prevLabel: 'Last week',
      cur: cumulative(dailyFrom(thisStart, 7)),
      prev: cumulative(dailyFrom(addDays(thisStart, -7), 7)),
      curLength: today.getDay() + 1,
      total: dailyFrom(thisStart, 7).reduce((s, v) => s + v, 0),
    }
  }
  if (mode === 'month-vs-year') {
    const thisStart = startOfMonth(today)
    const lastYearStart = new Date(today.getFullYear() - 1, today.getMonth(), 1)
    return {
      curLabel: 'This month', prevLabel: 'Last year',
      cur: cumulative(dailyFrom(thisStart, 30)),
      prev: cumulative(dailyFrom(lastYearStart, 30)),
      curLength: today.getDate(),
      total: dailyFrom(thisStart, 30).reduce((s, v) => s + v, 0),
    }
  }
  if (mode === 'month-vs-avg') {
    const thisStart = startOfMonth(today)
    const monthsBack = [1, 2, 3].map(n => startOfMonth(new Date(today.getFullYear(), today.getMonth() - n, 1)))
    const series = monthsBack.map(s => dailyFrom(s, 30))
    const avg = Array.from({ length: 30 }, (_, i) => series.reduce((s, arr) => s + arr[i], 0) / series.length)
    return {
      curLabel: 'This month', prevLabel: 'Average month',
      cur: cumulative(dailyFrom(thisStart, 30)),
      prev: cumulative(avg),
      curLength: today.getDate(),
      total: dailyFrom(thisStart, 30).reduce((s, v) => s + v, 0),
    }
  }
  if (mode === 'year') {
    const monthlyFrom = (year: number) => {
      const totals = Array(12).fill(0)
      for (const [key, amt] of Object.entries(dailyExpense)) {
        const d = new Date(key + 'T12:00:00')
        if (d.getFullYear() === year) totals[d.getMonth()] += amt
      }
      return totals
    }
    const thisYear = monthlyFrom(today.getFullYear())
    return {
      curLabel: 'This year', prevLabel: 'Last year',
      cur: cumulative(thisYear),
      prev: cumulative(monthlyFrom(today.getFullYear() - 1)),
      curLength: today.getMonth() + 1,
      total: thisYear.reduce((s, v) => s + v, 0),
    }
  }
  // 'month' (default)
  const thisStart = startOfMonth(today)
  const lastStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1))
  return {
    curLabel: 'This month', prevLabel: 'Last month',
    cur: cumulative(dailyFrom(thisStart, 30)),
    prev: cumulative(dailyFrom(lastStart, 30)),
    curLength: today.getDate(),
    total: dailyFrom(thisStart, 30).reduce((s, v) => s + v, 0),
  }
}

// ── Recent transactions filter (All / Needs Review by Anyone or a member) ──
type ReviewFilter = 'all' | 'anyone' | string

export interface RecentTransaction {
  id: string
  amount: number
  merchant: string | null
  description: string | null
  transactedAt: string
  isPending: boolean
  needsReview: boolean
  isTransfer: boolean
  owner: string | null
  categoryName: string | null
  categoryIcon: string | null
  isIncome: boolean
}

interface HouseholdMember { id: string; full_name: string; display_name: string; color: string; sort_order: number; is_shared: boolean }

export default function DashboardClient({
  userId,
  greetingName,
  monthLabel,
  incomeActual,
  incomePlanned,
  expenseActual,
  expensePlanned,
  recentTransactions,
  members,
  netWorthHistory,
  dailyExpense,
}: {
  userId: string
  greetingName: string | null
  monthLabel: string
  incomeActual: number
  incomePlanned: number
  expenseActual: number
  expensePlanned: number
  recentTransactions: RecentTransaction[]
  members: HouseholdMember[]
  netWorthHistory: { date: string; value: number }[]
  dailyExpense: Record<string, number>
}) {
  const [nwPeriod, setNwPeriod] = useState(90)
  const [compareMode, setCompareMode] = useState<CompareMode>('month')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [filteredTxns, setFilteredTxns] = useState<RecentTransaction[] | null>(null)
  const [loadingTxns, setLoadingTxns] = useState(false)

  const nwFiltered = useMemo(() => {
    const cutoff = cutoffForPeriod(nwPeriod)
    return cutoff ? netWorthHistory.filter(p => p.date >= cutoff) : netWorthHistory
  }, [netWorthHistory, nwPeriod])
  const currentNW = nwFiltered.length ? nwFiltered[nwFiltered.length - 1].value : 0
  const nwChange = nwFiltered.length ? currentNW - nwFiltered[0].value : 0

  const spending = useMemo(() => computeCompareSeries(compareMode, dailyExpense), [compareMode, dailyExpense])

  const applyReviewFilter = async (filter: ReviewFilter) => {
    setReviewFilter(filter)
    if (filter === 'all') { setFilteredTxns(null); return }
    setLoadingTxns(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('transactions')
        .select('id, amount, merchant, description, transacted_at, is_pending, needs_review, is_transfer, owner, categories(name, icon, is_income)')
        .eq('user_id', userId)
        .eq('needs_review', true)
        .order('transacted_at', { ascending: false })
        .limit(8)
      if (filter !== 'anyone') query = query.eq('owner', filter)
      const { data } = await query
      setFilteredTxns((data ?? []).map((t: any) => ({
        id: t.id,
        amount: Number(t.amount),
        merchant: t.merchant,
        description: t.description,
        transactedAt: t.transacted_at,
        isPending: t.is_pending ?? false,
        needsReview: t.needs_review ?? false,
        isTransfer: t.is_transfer ?? false,
        owner: t.owner ?? null,
        categoryName: t.categories?.name ?? null,
        categoryIcon: t.categories?.icon ?? null,
        isIncome: Number(t.amount) >= 0,
      })))
    } finally {
      setLoadingTxns(false)
    }
  }

  const displayedTxns = filteredTxns ?? recentTransactions

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">
        {greeting()}{greetingName ? `, ${greetingName}` : ''}!
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Budget</p>
              <p className="text-xs text-gray-400">{monthLabel}</p>
            </div>
            <div className="space-y-5">
              <ProgressRow label="Income" planned={incomePlanned} actual={incomeActual} barColor="#22c55e" />
              <ProgressRow label="Expenses" planned={expensePlanned} actual={expenseActual} barColor="#ef4444" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Transactions</p>
              <div className="flex items-center gap-3">
                <select
                  value={reviewFilter}
                  onChange={e => applyReviewFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600"
                >
                  <option value="all">All transactions</option>
                  <option value="anyone">Needs Review · Anyone</option>
                  {members.map(m => (
                    <option key={m.id} value={m.full_name}>Needs Review · {m.display_name}</option>
                  ))}
                </select>
                <Link href="/budget/transactions" className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                  See all
                </Link>
              </div>
            </div>
            <div className="space-y-1">
              {loadingTxns && (
                <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
              )}
              {!loadingTxns && displayedTxns.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  {reviewFilter === 'all' ? 'No transactions yet' : 'Nothing needs review'}
                </p>
              )}
              {!loadingTxns && displayedTxns.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">
                    {t.isTransfer ? '↔️' : getCatEmoji(t.categoryName ?? '', t.categoryIcon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.merchant || t.description || 'Transaction'}</p>
                    <p className="text-xs text-gray-400 truncate">{t.isTransfer ? 'Transfer' : (t.categoryName ?? 'Uncategorized')}</p>
                  </div>
                  {t.isPending && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex-shrink-0">Pending</span>
                  )}
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.isTransfer ? 'text-gray-400' : t.isIncome ? 'text-green-600' : 'text-gray-900'}`}>
                    {t.isIncome ? '+' : '-'}${fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Net Worth</p>
              <div className="flex gap-1">
                {NW_PERIODS.map(p => (
                  <button key={p.label} onClick={() => setNwPeriod(p.days)}
                    className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition ${
                      nwPeriod === p.days ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-2xl font-bold text-gray-900">${fmt(currentNW)}</p>
              {nwFiltered.length > 1 && (
                <span className={`text-xs font-semibold ${nwChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {nwChange >= 0 ? '+' : '-'}${fmt(Math.abs(nwChange))}
                </span>
              )}
            </div>
            <MiniNetWorthChart series={nwFiltered} />
            <Link href="/budget/accounts" className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-700 font-medium">
              View accounts
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Spending</p>
              <select
                value={compareMode}
                onChange={e => setCompareMode(e.target.value as CompareMode)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600"
              >
                {COMPARE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-3">${fmt(spending.total)}</p>
            <SpendingCompareChart cur={spending.cur} prev={spending.prev} curLength={spending.curLength} />
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> {spending.curLabel}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> {spending.prevLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
