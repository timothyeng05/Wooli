'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PlaidLinkButton from './PlaidLinkButton'

interface BalanceRow { account_name: string; date: string; balance: number }
interface PlaidAccount { account_id: string; name: string; type: string; mask: string | null; current_balance: number | null; owner: string | null }
interface PlaidItem { item_id: string; institution_name: string | null }

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: Infinity },
]

const INVEST_PAT = /401.?k|ira|roth|brokerage|wealth builder|fidelity|vanguard|schwab invest/i

function classify(name: string, balance: number): 'investment' | 'credit' | 'cash' {
  if (INVEST_PAT.test(name)) return 'investment'
  if (balance < 0) return 'credit'
  return 'cash'
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtK(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, isAsset }: { values: number[]; isAsset: boolean }) {
  if (values.length < 2) return <div className="w-20 h-8 flex-shrink-0" />
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

// ── Main net-worth chart ──────────────────────────────────────────────────────
const CW = 600, CH_TOTAL = 180, PL = 56, PR = 16, PT = 12, PB = 28
const IW = CW - PL - PR, IH = CH_TOTAL - PT - PB

function NetWorthChart({ series }: { series: { date: string; value: number }[] }) {
  const [period, setPeriod] = useState(90)
  const [hover, setHover] = useState<number | null>(null)

  const cutoff = period === Infinity ? null
    : new Date(Date.now() - period * 86400000).toISOString().split('T')[0]
  const pts = cutoff ? series.filter(p => p.date >= cutoff) : series
  if (pts.length < 2) return (
    <div className="w-full h-44 flex items-center justify-center text-sm text-gray-400">
      No balance history — import a CSV below to see trends
    </div>
  )

  const vals = pts.map(p => p.value)
  const minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1

  function xOf(i: number) { return PL + (i / (pts.length - 1)) * IW }
  function yOf(v: number) { return PT + IH - ((v - minV) / range) * IH }

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ')
  const areaPath = linePath + ` L${xOf(pts.length - 1).toFixed(1)},${(PT + IH).toFixed(1)} L${PL},${(PT + IH).toFixed(1)} Z`

  // y-axis labels
  const step = Math.ceil(((maxV - minV) / 4) / 25000) * 25000 || 25000
  const yLabels: { v: number; y: number }[] = []
  for (let v = Math.floor(minV / step) * step; v <= Math.ceil(maxV / step) * step; v += step) {
    const y = yOf(v)
    if (y >= PT - 6 && y <= PT + IH + 6) yLabels.push({ v, y })
  }

  // x-axis month labels
  const xLabels: { label: string; x: number }[] = []
  let lastMon = ''
  pts.forEach((p, i) => {
    const m = p.date.slice(0, 7)
    if (m !== lastMon) {
      lastMon = m
      xLabels.push({
        label: new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }),
        x: xOf(i),
      })
    }
  })

  const hoverPt = hover !== null ? pts[hover] : null

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {PERIODS.map(p => (
          <button key={p.label} onClick={() => setPeriod(p.days)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              period === p.days ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${CW} ${CH_TOTAL}`} className="w-full" style={{ height: CH_TOTAL }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const px = (e.clientX - rect.left) / rect.width * CW
            const idx = Math.round(((px - PL) / IW) * (pts.length - 1))
            setHover(Math.max(0, Math.min(pts.length - 1, idx)))
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
                {v >= 0 ? '' : '-'}${Math.abs(v / 1000).toFixed(0)}k
              </text>
            </g>
          ))}
          <path d={areaPath} fill="url(#nwGrad)" />
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x.toFixed(1)} y={CH_TOTAL - 4} textAnchor="middle"
              style={{ fontSize: 10, fill: '#94a3b8' }}>{label}</text>
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
function AccountRow({ name, balance, sparkValues, latestDate, owner }: {
  name: string; balance: number; sparkValues: number[]; latestDate: string; owner?: string | null
}) {
  const isAsset = balance >= 0
  const daysAgo = Math.round((Date.now() - new Date(latestDate + 'T12:00:00').getTime()) / 86400000)
  const ago = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`
  const initial = name.trim()[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        isAsset ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
      }`}>{initial}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-gray-400">{ago}</p>
          {owner && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              owner === 'Timothy Eng' ? 'bg-blue-100 text-blue-600'
              : owner === 'Jessica Li' ? 'bg-rose-100 text-rose-500'
              : 'bg-gray-100 text-gray-500'
            }`}>
              {owner === 'Timothy Eng' ? 'Tim' : owner === 'Jessica Li' ? 'Jess' : 'Shared'}
            </span>
          )}
        </div>
      </div>
      <Sparkline values={sparkValues} isAsset={isAsset} />
      <p className={`text-sm font-semibold tabular-nums flex-shrink-0 w-28 text-right ${
        isAsset ? 'text-gray-900' : 'text-red-600'
      }`}>
        {isAsset ? '' : '-'}${fmt(Math.abs(balance))}
      </p>
    </div>
  )
}

// ── Account group ─────────────────────────────────────────────────────────────
function AccountGroup({ label, total, monthChange, accounts, history, ownerMap, open, onToggle }: {
  label: string; total: number; monthChange: number
  accounts: string[]; history: Map<string, { date: string; balance: number }[]>
  ownerMap: Map<string, string | null>; open: boolean; onToggle: () => void
}) {
  if (accounts.length === 0) return null
  const isAsset = total >= 0
  const changePct = monthChange !== 0 && (total - monthChange) !== 0
    ? ((monthChange / Math.abs(total - monthChange)) * 100)
    : 0

  return (
    <div className="mb-2">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg transition group">
        <div className="flex items-center gap-2">
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {monthChange !== 0 && (
            <span className={`text-xs font-medium ${monthChange >= 0 === isAsset ? 'text-green-600' : 'text-red-500'}`}>
              {fmtK(monthChange)} ({Math.abs(changePct).toFixed(1)}%)
            </span>
          )}
        </div>
        <span className={`text-sm font-semibold ${isAsset ? 'text-gray-900' : 'text-red-600'}`}>
          {isAsset ? '' : '-'}${fmt(Math.abs(total))}
        </span>
      </button>
      {open && (
        <div className="ml-2">
          {accounts.map(name => {
            const acctHistory = history.get(name) ?? []
            const latest = acctHistory[acctHistory.length - 1]
            const sparkValues = acctHistory.map(r => r.balance)
            return (
              <AccountRow
                key={name}
                name={name}
                balance={latest?.balance ?? 0}
                sparkValues={sparkValues}
                latestDate={latest?.date ?? ''}
                owner={ownerMap.get(name)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AccountsPageClient({
  initialBalanceHistory,
  plaidAccounts,
  plaidItems,
}: {
  initialBalanceHistory: BalanceRow[]
  plaidAccounts: PlaidAccount[]
  plaidItems: PlaidItem[]
}) {
  const router = useRouter()
  const [balanceHistory, setBalanceHistory] = useState(initialBalanceHistory)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [openGroups, setOpenGroups] = useState({ cash: true, investments: true, credit: true })
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Derived data ─────────────────────────────────────────────────────────
  const { netWorthSeries, accountGroups, accountHistory, latestBalances, ownerMap, summary, currentNW, monthChange } = useMemo(() => {
    // Sort history by date
    const sorted = [...balanceHistory].sort((a, b) => a.date.localeCompare(b.date))

    // Per-account history (sorted)
    const accountHistory = new Map<string, { date: string; balance: number }[]>()
    for (const row of sorted) {
      if (!accountHistory.has(row.account_name)) accountHistory.set(row.account_name, [])
      accountHistory.get(row.account_name)!.push({ date: row.date, balance: row.balance })
    }

    // Latest balance per account
    const latestBalances = new Map<string, number>()
    for (const [name, rows] of accountHistory) {
      latestBalances.set(name, rows[rows.length - 1].balance)
    }

    // Owner map from Plaid accounts (match by name prefix)
    const ownerMap = new Map<string, string | null>()
    for (const name of latestBalances.keys()) {
      const plaid = plaidAccounts.find(a =>
        name.toLowerCase().includes(a.name.toLowerCase().slice(0, 8)) ||
        (a.mask && name.includes(a.mask))
      )
      ownerMap.set(name, plaid?.owner ?? null)
    }

    // Account groups
    const cash: string[] = [], investments: string[] = [], credit: string[] = []
    for (const [name, bal] of latestBalances) {
      const type = classify(name, bal)
      if (type === 'cash') cash.push(name)
      else if (type === 'investment') investments.push(name)
      else credit.push(name)
    }

    // Daily net worth
    const dateSet = new Set(sorted.map(r => r.date))
    const allDates = [...dateSet].sort()
    // Track running balance per account (carry forward last known value)
    const lastKnown = new Map<string, number>()
    const netWorthSeries: { date: string; value: number }[] = []
    for (const date of allDates) {
      const dayRows = sorted.filter(r => r.date === date)
      for (const r of dayRows) lastKnown.set(r.account_name, r.balance)
      const nw = [...lastKnown.values()].reduce((s, v) => s + v, 0)
      netWorthSeries.push({ date, value: nw })
    }

    // Summary totals
    let assets = 0, liabilities = 0, investTotal = 0, cashTotal = 0, creditTotal = 0
    for (const [name, bal] of latestBalances) {
      const type = classify(name, bal)
      if (bal >= 0) {
        assets += bal
        if (type === 'investment') investTotal += bal
        else cashTotal += bal
      } else {
        liabilities += Math.abs(bal)
        creditTotal += Math.abs(bal)
      }
    }

    const currentNW = assets - liabilities

    // 1-month change
    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const pastPt = [...netWorthSeries].reverse().find(p => p.date <= oneMonthAgo)
    const monthChange = pastPt ? currentNW - pastPt.value : 0

    // Group month changes
    function groupMonthChange(names: string[]) {
      return names.reduce((s, name) => {
        const h = accountHistory.get(name) ?? []
        const latest = h[h.length - 1]?.balance ?? 0
        const past = [...h].reverse().find(r => r.date <= oneMonthAgo)?.balance ?? latest
        return s + (latest - past)
      }, 0)
    }

    return {
      netWorthSeries, accountGroups: { cash, investments, credit },
      accountHistory, latestBalances, ownerMap, currentNW, monthChange,
      summary: { assets, liabilities, investTotal, cashTotal, creditTotal },
      cashMonthChange: groupMonthChange(cash),
      investMonthChange: groupMonthChange(investments),
      creditMonthChange: groupMonthChange(credit),
    }
  }, [balanceHistory, plaidAccounts])

  const cashTotal = accountGroups.cash.reduce((s, n) => s + (latestBalances.get(n) ?? 0), 0)
  const investTotal = accountGroups.investments.reduce((s, n) => s + (latestBalances.get(n) ?? 0), 0)
  const creditTotal = accountGroups.credit.reduce((s, n) => s + Math.abs(latestBalances.get(n) ?? 0), 0)

  function groupMonthChange(names: string[]) {
    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    return names.reduce((s, name) => {
      const h = accountHistory.get(name) ?? []
      const latest = h[h.length - 1]?.balance ?? 0
      const past = [...h].reverse().find(r => r.date <= oneMonthAgo)?.balance ?? latest
      return s + (latest - past)
    }, 0)
  }

  // ── CSV import ────────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setImporting(true)
    setImportMsg('')
    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const rows = lines.slice(1).map(line => {
        const firstComma = line.indexOf(',')
        const secondComma = line.indexOf(',', firstComma + 1)
        const date = line.slice(0, firstComma)
        const balance = parseFloat(line.slice(firstComma + 1, secondComma))
        const account = line.slice(secondComma + 1).replace(/^"|"$/g, '').trim()
        return { date, balance, account }
      }).filter(r => r.date && r.account && isFinite(r.balance))

      const res = await fetch('/api/budget/import-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const { imported, total } = await res.json()
      setImportMsg(`Imported ${imported} of ${total} balance records`)
      router.refresh()
    } catch (e) {
      setImportMsg('Import failed — check the file format')
    } finally {
      setImporting(false)
    }
  }

  const changePct = monthChange !== 0 && (currentNW - monthChange) !== 0
    ? Math.abs(monthChange / Math.abs(currentNW - monthChange) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-8">
      {/* ── Net worth header ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Net Worth</p>
        <div className="flex items-baseline gap-3 mb-1">
          <p className="text-4xl font-bold text-gray-900">${fmt(currentNW)}</p>
          {monthChange !== 0 && (
            <span className={`text-sm font-semibold ${monthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtK(monthChange)} ({changePct}%) 1 month
            </span>
          )}
        </div>
        <NetWorthChart series={netWorthSeries} />
      </div>

      {/* ── Accounts + Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account groups */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <AccountGroup
            label="Cash" total={cashTotal}
            monthChange={groupMonthChange(accountGroups.cash)}
            accounts={accountGroups.cash} history={accountHistory}
            ownerMap={ownerMap} open={openGroups.cash}
            onToggle={() => setOpenGroups(g => ({ ...g, cash: !g.cash }))}
          />
          <AccountGroup
            label="Investments" total={investTotal}
            monthChange={groupMonthChange(accountGroups.investments)}
            accounts={accountGroups.investments} history={accountHistory}
            ownerMap={ownerMap} open={openGroups.investments}
            onToggle={() => setOpenGroups(g => ({ ...g, investments: !g.investments }))}
          />
          <AccountGroup
            label="Credit Cards" total={-creditTotal}
            monthChange={-groupMonthChange(accountGroups.credit)}
            accounts={accountGroups.credit} history={accountHistory}
            ownerMap={ownerMap} open={openGroups.credit}
            onToggle={() => setOpenGroups(g => ({ ...g, credit: !g.credit }))}
          />

          {balanceHistory.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">
              No balance data yet — import a Monarch CSV to see your accounts
            </p>
          )}
        </div>

        {/* Summary panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Summary</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-semibold text-gray-700">Assets</span>
                <span className="text-sm font-bold text-gray-900">${fmt(summary.assets)}</span>
              </div>
              <div className="w-full bg-blue-50 rounded-full h-1.5 mb-3">
                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: '100%' }} />
              </div>
              <div className="ml-3 space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Investments</span>
                  <span className="font-medium text-gray-700">${fmt(summary.investTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Cash</span>
                  <span className="font-medium text-gray-700">${fmt(summary.cashTotal)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-semibold text-gray-700">Liabilities</span>
                <span className="text-sm font-bold text-red-600">-${fmt(summary.liabilities)}</span>
              </div>
              <div className="w-full bg-red-50 rounded-full h-1.5 mb-3">
                <div className="h-1.5 rounded-full bg-red-400"
                  style={{ width: `${Math.min(100, (summary.liabilities / (summary.assets || 1)) * 100).toFixed(1)}%` }} />
              </div>
              <div className="ml-3">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Credit Cards</span>
                  <span className="font-medium text-gray-700">-${fmt(summary.creditTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Import balance history ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Balance History</p>
            <p className="text-xs text-gray-500 mt-0.5">Import from Monarch: Accounts → Download CSV</p>
          </div>
          <div className="flex items-center gap-3">
            {importMsg && <p className="text-xs text-gray-500">{importMsg}</p>}
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
          </div>
        </div>
        {balanceHistory.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">
            {balanceHistory.length.toLocaleString()} records · {new Set(balanceHistory.map(r => r.account_name)).size} accounts · last updated {balanceHistory.reduce((a, b) => a.date > b.date ? a : b).date}
          </p>
        )}
      </div>

      {/* ── Connected accounts (Plaid) ── */}
      {plaidItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Connected Accounts</p>
            <PlaidLinkButton />
          </div>
          <div className="space-y-3">
            {plaidItems.map(item => {
              const accounts = plaidAccounts.filter(a => (a as any).item_id === item.item_id)
              return (
                <div key={item.item_id} className="rounded-lg border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-600">{item.institution_name ?? 'Bank'}</p>
                  </div>
                  {accounts.map(a => (
                    <div key={a.account_id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900 font-medium">
                          {a.name}{a.mask && <span className="text-gray-400 font-normal"> ···{a.mask}</span>}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{a.type}</p>
                      </div>
                      <p className={`text-sm font-semibold ${a.type === 'credit' || a.type === 'loan' ? 'text-red-600' : 'text-gray-900'}`}>
                        ${fmt(a.current_balance ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
