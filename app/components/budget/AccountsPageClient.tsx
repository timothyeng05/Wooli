'use client'

import { useState, useMemo } from 'react'

export interface UnifiedAccount {
  id: string
  name: string
  mask: string | null
  type: 'cash' | 'investment' | 'credit' | 'loan'
  institution: string | null
  balance: number
  owner: string | null
  source: 'plaid' | 'manual'
}

export interface BalancePoint {
  account_id: string
  date: string
  balance: number
}

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: Infinity },
]

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtShort(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, isAsset }: { values: number[]; isAsset: boolean }) {
  if (values.length < 2) {
    return (
      <div className="w-20 h-8 flex-shrink-0 flex items-center justify-center">
        <div className="w-16 h-px bg-gray-200" />
      </div>
    )
  }
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const W = 80, H = 32
  const pts = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * W).toFixed(1)
    const y = (H - 4 - ((v - min) / range) * (H - 8)).toFixed(1)
    return `${x},${y}`
  }).join(' ')
  const trend = values[values.length - 1] - values[0]
  const color = isAsset ? (trend >= 0 ? '#22c55e' : '#ef4444') : (trend <= 0 ? '#22c55e' : '#ef4444')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Net worth chart ───────────────────────────────────────────────────────────
const CW = 600, CH = 180, PL = 56, PR = 16, PT = 12, PB = 28
const IW = CW - PL - PR, IH = CH - PT - PB

function NetWorthChart({ series, period, onPeriod }: {
  series: { date: string; value: number }[]
  period: number
  onPeriod: (d: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  const cutoff = period === Infinity ? null
    : new Date(Date.now() - period * 86400000).toISOString().split('T')[0]
  const pts = cutoff ? series.filter(p => p.date >= cutoff) : series

  if (pts.length < 2) {
    return (
      <div>
        <div className="flex gap-1 mb-3">
          {PERIODS.map(p => (
            <button key={p.label} onClick={() => onPeriod(p.days)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                period === p.days ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
              }`}>{p.label}</button>
          ))}
        </div>
        <div className="h-40 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Balance history builds automatically each time you visit — check back tomorrow to see a trend
        </div>
      </div>
    )
  }

  const vals = pts.map(p => p.value)
  const minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1
  function xOf(i: number) { return PL + (i / (pts.length - 1)) * IW }
  function yOf(v: number) { return PT + IH - ((v - minV) / range) * IH }

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xOf(pts.length - 1).toFixed(1)},${(PT + IH).toFixed(1)} L${PL},${(PT + IH).toFixed(1)} Z`

  const step = Math.ceil(((maxV - minV) / 4) / 25000) * 25000 || 25000
  const yLabels: { v: number; y: number }[] = []
  for (let v = Math.floor(minV / step) * step; v <= Math.ceil(maxV / step) * step; v += step) {
    const y = yOf(v)
    if (y >= PT - 6 && y <= PT + IH + 6) yLabels.push({ v, y })
  }

  const xLabels: { label: string; x: number }[] = []
  let lastMon = ''
  pts.forEach((p, i) => {
    const m = p.date.slice(0, 7)
    if (m !== lastMon) {
      lastMon = m
      xLabels.push({ label: new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }), x: xOf(i) })
    }
  })

  const hoverPt = hover !== null ? pts[hover] : null

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {PERIODS.map(p => (
          <button key={p.label} onClick={() => onPeriod(p.days)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              period === p.days ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
            }`}>{p.label}</button>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: CH }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const px = (e.clientX - rect.left) / rect.width * CW
            setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((px - PL) / IW) * (pts.length - 1)))))
          }}>
          <defs>
            <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {yLabels.map(({ v, y }) => (
            <g key={v}>
              <line x1={PL} y1={y.toFixed(1)} x2={CW - PR} y2={y.toFixed(1)} stroke="#f1f5f9" strokeWidth="1" />
              <text x={PL - 6} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: '#94a3b8' }}>
                {v < 0 ? '-' : ''}${Math.abs(v / 1000).toFixed(0)}k
              </text>
            </g>
          ))}
          <path d={areaPath} fill="url(#nwGrad)" />
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x.toFixed(1)} y={CH - 4} textAnchor="middle" style={{ fontSize: 10, fill: '#94a3b8' }}>{label}</text>
          ))}
          {hoverPt && hover !== null && (
            <>
              <line x1={xOf(hover).toFixed(1)} y1={PT} x2={xOf(hover).toFixed(1)} y2={PT + IH}
                stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={xOf(hover).toFixed(1)} cy={yOf(hoverPt.value).toFixed(1)} r="4"
                fill="#3b82f6" stroke="white" strokeWidth="2" />
            </>
          )}
        </svg>
        {hoverPt && (
          <div className="absolute top-2 left-16 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm pointer-events-none text-xs">
            <p className="font-semibold text-gray-900">${fmt(hoverPt.value)}</p>
            <p className="text-gray-400">{new Date(hoverPt.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Account row ───────────────────────────────────────────────────────────────
function AccountRow({ account, sparkValues }: { account: UnifiedAccount; sparkValues: number[] }) {
  const isAsset = account.type !== 'credit' && account.type !== 'loan'
  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition">
      {/* Icon */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        isAsset ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
      }`}>
        {account.name.trim()[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Name + institution */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">
            {account.name}
            {account.mask && <span className="text-gray-400 font-normal"> ···{account.mask}</span>}
          </p>
          {account.owner && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              account.owner === 'Timothy Eng' ? 'bg-blue-100 text-blue-600'
              : account.owner === 'Jessica Li' ? 'bg-rose-100 text-rose-500'
              : 'bg-gray-100 text-gray-500'
            }`}>
              {account.owner === 'Timothy Eng' ? 'Tim' : account.owner === 'Jessica Li' ? 'Jess' : 'Shared'}
            </span>
          )}
        </div>
        {account.institution && (
          <p className="text-xs text-gray-400 mt-0.5">{account.institution}</p>
        )}
      </div>

      {/* Sparkline */}
      <Sparkline values={sparkValues} isAsset={isAsset} />

      {/* Balance */}
      <p className={`text-sm font-semibold tabular-nums flex-shrink-0 w-28 text-right ${
        isAsset ? 'text-gray-900' : 'text-red-600'
      }`}>
        {isAsset ? '' : '-'}${fmt(Math.abs(account.balance))}
      </p>
    </div>
  )
}

// ── Account group ─────────────────────────────────────────────────────────────
function AccountGroup({ label, accounts, sparkMap, netWorthSeries, open, onToggle }: {
  label: string
  accounts: UnifiedAccount[]
  sparkMap: Map<string, number[]>
  netWorthSeries: { date: string; value: number }[]
  open: boolean
  onToggle: () => void
}) {
  if (accounts.length === 0) return null
  const isAsset = accounts[0].type !== 'credit' && accounts[0].type !== 'loan'
  const total = accounts.reduce((s, a) => s + a.balance, 0)

  // Month change from history
  const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const groupIds = new Set(accounts.map(a => a.id))

  return (
    <div className="mb-1">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg transition">
        <div className="flex items-center gap-2">
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          <span className="text-xs text-gray-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
        </div>
        <span className={`text-sm font-semibold ${isAsset ? 'text-gray-900' : 'text-red-600'}`}>
          {isAsset ? '' : '-'}${fmt(Math.abs(total))}
        </span>
      </button>
      {open && (
        <div className="ml-2 mt-0.5">
          {accounts.map(a => (
            <AccountRow key={a.id} account={a} sparkValues={sparkMap.get(a.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountsPageClient({
  accounts,
  history,
}: {
  accounts: UnifiedAccount[]
  history: BalancePoint[]
}) {
  const [period, setPeriod] = useState(90)
  const [open, setOpen] = useState({ cash: true, investments: true, credit: true })

  const { cash, investments, credit, netWorthSeries, sparkMap, summary, currentNW, monthChange } = useMemo(() => {
    const cash = accounts.filter(a => a.type === 'cash')
    const investments = accounts.filter(a => a.type === 'investment')
    const credit = accounts.filter(a => a.type === 'credit' || a.type === 'loan')

    // Sparkline values per account (chronological)
    const sparkMap = new Map<string, number[]>()
    for (const a of accounts) {
      const pts = history
        .filter(h => h.account_id === a.id)
        .sort((x, y) => x.date.localeCompare(y.date))
        .map(h => h.balance)
      sparkMap.set(a.id, pts)
    }

    // Net worth series: one point per date, sum all accounts
    const dateMap = new Map<string, Map<string, number>>()
    for (const h of history) {
      if (!dateMap.has(h.date)) dateMap.set(h.date, new Map())
      dateMap.get(h.date)!.set(h.account_id, h.balance)
    }
    // Carry forward last known balance per account
    const lastKnown = new Map<string, number>()
    const netWorthSeries = [...dateMap.keys()].sort().map(date => {
      const dayMap = dateMap.get(date)!
      for (const [id, bal] of dayMap) lastKnown.set(id, bal)
      const value = [...lastKnown.values()].reduce((s, v) => s + v, 0)
      return { date, value }
    })

    // Summary
    const assets = accounts.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
    const liabilities = accounts.filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)
    const investTotal = investments.reduce((s, a) => s + a.balance, 0)
    const cashTotal = cash.reduce((s, a) => s + a.balance, 0)
    const currentNW = assets - liabilities

    // 1-month change
    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const pastPt = [...netWorthSeries].reverse().find(p => p.date <= oneMonthAgo)
    const monthChange = pastPt ? currentNW - pastPt.value : 0

    return { cash, investments, credit, netWorthSeries, sparkMap, currentNW, monthChange,
      summary: { assets, liabilities, investTotal, cashTotal, creditTotal: liabilities } }
  }, [accounts, history])

  const changePct = monthChange !== 0 && (currentNW - monthChange) !== 0
    ? Math.abs(monthChange / Math.abs(currentNW - monthChange) * 100).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Net worth header + chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Net Worth</p>
        <div className="flex items-baseline gap-3 mb-4">
          <p className="text-4xl font-bold text-gray-900">${fmt(currentNW)}</p>
          {changePct && (
            <span className={`text-sm font-semibold ${monthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtShort(monthChange)} ({changePct}%) 1 month
            </span>
          )}
        </div>
        <NetWorthChart series={netWorthSeries} period={period} onPeriod={setPeriod} />
      </div>

      {/* Accounts + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Account groups */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <AccountGroup label="Cash" accounts={cash} sparkMap={sparkMap}
            netWorthSeries={netWorthSeries} open={open.cash}
            onToggle={() => setOpen(o => ({ ...o, cash: !o.cash }))} />
          <AccountGroup label="Investments" accounts={investments} sparkMap={sparkMap}
            netWorthSeries={netWorthSeries} open={open.investments}
            onToggle={() => setOpen(o => ({ ...o, investments: !o.investments }))} />
          <AccountGroup label="Credit Cards" accounts={credit} sparkMap={sparkMap}
            netWorthSeries={netWorthSeries} open={open.credit}
            onToggle={() => setOpen(o => ({ ...o, credit: !o.credit }))} />
          {accounts.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">No accounts connected yet</p>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Summary</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm font-semibold text-gray-700">Assets</span>
                <span className="text-sm font-bold text-gray-900">${fmt(summary.assets)}</span>
              </div>
              <div className="w-full bg-blue-50 rounded-full h-1.5 mb-3">
                <div className="h-1.5 rounded-full bg-blue-500 w-full" />
              </div>
              <div className="ml-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Investments</span>
                  <span className="font-medium text-gray-700">${fmt(summary.investTotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Cash</span>
                  <span className="font-medium text-gray-700">${fmt(summary.cashTotal)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm font-semibold text-gray-700">Liabilities</span>
                <span className="text-sm font-bold text-red-600">-${fmt(summary.liabilities)}</span>
              </div>
              <div className="w-full bg-red-50 rounded-full h-1.5 mb-3">
                <div className="h-1.5 rounded-full bg-red-400"
                  style={{ width: `${Math.min(100, (summary.liabilities / (summary.assets || 1)) * 100).toFixed(1)}%` }} />
              </div>
              <div className="ml-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Credit Cards</span>
                  <span className="font-medium text-gray-700">-${fmt(summary.creditTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
