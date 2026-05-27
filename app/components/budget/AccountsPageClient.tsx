'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { ACCOUNT_TYPES, isAssetType, OWNERS, type AccountType } from '@/lib/budget/account-utils'
import { useToast } from '@/app/components/ui/ToastProvider'

export interface UnifiedAccount {
  id: string
  name: string
  mask: string | null
  type: 'cash' | 'investment' | 'credit' | 'loan'
  rawType?: string
  institution: string | null
  balance: number
  owner: string | null
  updatedAt?: string | null
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

// Types allowed per group
const GROUP_TYPES: Record<string, AccountType[]> = {
  cash: ['checking', 'savings', 'cash', 'other'],
  investment: ['investment'],
  credit: ['credit', 'loan'],
}
const GROUP_DEFAULT: Record<string, AccountType> = {
  cash: 'checking',
  investment: 'investment',
  credit: 'credit',
}

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

// ── Plaid account row (read-only) ─────────────────────────────────────────────
function PlaidAccountRow({ account, sparkValues }: { account: UnifiedAccount; sparkValues: number[] }) {
  const isAsset = account.type !== 'credit' && account.type !== 'loan'
  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        isAsset ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
      }`}>
        {account.name.trim()[0]?.toUpperCase() ?? '?'}
      </div>
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
        {account.updatedAt && (
          <p className="text-[10px] text-gray-300 mt-0.5">
            Updated {new Date(account.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
      <Sparkline values={sparkValues} isAsset={isAsset} />
      <p className={`text-sm font-semibold tabular-nums flex-shrink-0 w-28 text-right ${
        isAsset ? 'text-gray-900' : 'text-red-600'
      }`}>
        {isAsset ? '' : '-'}${fmt(Math.abs(account.balance))}
      </p>
    </div>
  )
}

// ── Manual account row (editable) ─────────────────────────────────────────────
function ManualAccountRow({ account, sparkValues, onUpdate, onArchive }: {
  account: UnifiedAccount
  sparkValues: number[]
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onArchive: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editingBalance, setEditingBalance] = useState(false)
  const [name, setName] = useState(account.name)
  const [institution, setInstitution] = useState(account.institution || '')
  const [balance, setBalance] = useState(String(Math.abs(account.balance)))
  const [quickBal, setQuickBal] = useState(String(Math.abs(account.balance)))
  const [type, setType] = useState<AccountType>((account.rawType as AccountType) ?? 'checking')
  const [owner, setOwner] = useState(account.owner || '')
  const [saving, setSaving] = useState(false)
  const [savingBalance, setSavingBalance] = useState(false)

  const isAsset = account.type !== 'credit' && account.type !== 'loan'

  const save = async () => {
    setSaving(true)
    try {
      const newIsAsset = isAssetType(type)
      await onUpdate(account.id, {
        name: name.trim(),
        institution: institution.trim() || null,
        current_balance: parseFloat(balance) || 0,
        type,
        is_asset: newIsAsset,
        owner: owner || null,
        updated_at: new Date().toISOString(),
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const saveQuickBalance = async () => {
    setSavingBalance(true)
    try {
      await onUpdate(account.id, { current_balance: parseFloat(quickBal) || 0, updated_at: new Date().toISOString() })
      setEditingBalance(false)
    } finally {
      setSavingBalance(false)
    }
  }

  if (editing) {
    return (
      <div className="mx-3 my-1 border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Institution</label>
            <input type="text" value={institution} onChange={e => setInstitution(e.target.value)}
              placeholder="Chase, Apple, etc."
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
            <select value={type} onChange={e => setType(e.target.value as AccountType)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
              {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Balance</label>
            <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Owner</label>
            <select value={owner} onChange={e => setOwner(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
              <option value="">—</option>
              {OWNERS.map(o => <option key={o} value={o}>{o === 'Timothy Eng' ? 'Tim' : o === 'Jessica Li' ? 'Jess' : o}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
            Save
          </button>
          <button onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-gray-500 rounded text-xs hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={() => { setEditing(false); onArchive(account.id) }}
            className="ml-auto px-3 py-1.5 text-red-400 rounded text-xs hover:text-red-600 hover:bg-red-50">
            Archive
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => !editingBalance && setEditing(true)}
      className="group w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition cursor-pointer"
      title="Click to edit"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        isAsset ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
      }`}>
        {account.name.trim()[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{account.name}</p>
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
        {account.institution && <p className="text-xs text-gray-400 mt-0.5">{account.institution}</p>}
        {account.updatedAt && (
          <p className="text-[10px] text-gray-300 mt-0.5">
            Updated {new Date(account.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
      {editingBalance ? (
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <input
            type="number"
            step="0.01"
            value={quickBal}
            onChange={e => setQuickBal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveQuickBalance()
              if (e.key === 'Escape') setEditingBalance(false)
            }}
            autoFocus
            className="w-28 px-2 py-1 border border-blue-400 rounded text-sm text-right bg-white"
          />
          <button onClick={saveQuickBalance} disabled={savingBalance}
            className="text-green-600 hover:text-green-700 p-1 disabled:opacity-50" title="Save">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button onClick={() => setEditingBalance(false)}
            className="text-gray-400 hover:text-gray-600 p-1" title="Cancel">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Sparkline values={sparkValues} isAsset={isAsset} />
          <p className={`text-sm font-semibold tabular-nums w-28 text-right ${
            isAsset ? 'text-gray-900' : 'text-red-600'
          }`}>
            {isAsset ? '' : '-'}${fmt(Math.abs(account.balance))}
          </p>
          <button
            onClick={() => { setQuickBal(String(Math.abs(account.balance))); setEditingBalance(true) }}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-500 transition-opacity"
            title="Update balance"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Inline add form ───────────────────────────────────────────────────────────
function AddAccountInlineForm({ groupKey, userId, onDone }: {
  groupKey: 'cash' | 'investment' | 'credit'
  userId: string
  onDone: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const allowedTypes = GROUP_TYPES[groupKey]
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [type, setType] = useState<AccountType>(GROUP_DEFAULT[groupKey])
  const [balance, setBalance] = useState('0')
  const [owner, setOwner] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('accounts').insert({
        user_id: userId,
        name: name.trim(),
        type,
        institution: institution.trim() || null,
        current_balance: parseFloat(balance) || 0,
        is_asset: isAssetType(type),
        owner: owner || null,
      })
      if (error) throw error
      onDone()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-3 my-2 border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2.5">
      <p className="text-xs font-semibold text-gray-700">New account</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus
            placeholder="e.g. Chase Checking"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Institution</label>
          <input type="text" value={institution} onChange={e => setInstitution(e.target.value)}
            placeholder="Chase, Apple, etc."
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
          <select value={type} onChange={e => setType(e.target.value as AccountType)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            {ACCOUNT_TYPES.filter(t => allowedTypes.includes(t.value)).map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Balance</label>
          <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Owner</label>
          <select value={owner} onChange={e => setOwner(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            <option value="">—</option>
            {OWNERS.map(o => <option key={o} value={o}>{o === 'Timothy Eng' ? 'Tim' : o === 'Jessica Li' ? 'Jess' : o}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
          Add
        </button>
        <button type="button" onClick={onDone}
          className="px-3 py-1.5 text-gray-500 rounded text-xs hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Account group ─────────────────────────────────────────────────────────────
function AccountGroup({ label, groupKey, accounts, sparkMap, open, onToggle, userId, onUpdate, onArchive }: {
  label: string
  groupKey: 'cash' | 'investment' | 'credit'
  accounts: UnifiedAccount[]
  sparkMap: Map<string, number[]>
  open: boolean
  onToggle: () => void
  userId: string
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onArchive: (id: string) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  if (accounts.length === 0 && !adding) {
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
            <span className="text-xs text-gray-400">0 accounts</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setAdding(true) }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-1"
          >
            + Add
          </button>
        </button>
        {adding && (
          <AddAccountInlineForm groupKey={groupKey} userId={userId} onDone={() => setAdding(false)} />
        )}
      </div>
    )
  }

  const isAsset = accounts[0]?.type !== 'credit' && accounts[0]?.type !== 'loan'
  const total = accounts.reduce((s, a) => s + a.balance, 0)

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
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); setAdding(true) }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add
          </button>
          <span className={`text-sm font-semibold ${isAsset ? 'text-gray-900' : 'text-red-600'}`}>
            {isAsset ? '' : '-'}${fmt(Math.abs(total))}
          </span>
        </div>
      </button>
      {open && (
        <div className="ml-2 mt-0.5">
          {accounts.map(a =>
            a.source === 'manual'
              ? <ManualAccountRow key={a.id} account={a} sparkValues={sparkMap.get(a.id) ?? []} onUpdate={onUpdate} onArchive={onArchive} />
              : <PlaidAccountRow key={a.id} account={a} sparkValues={sparkMap.get(a.id) ?? []} />
          )}
          {adding && (
            <AddAccountInlineForm groupKey={groupKey} userId={userId} onDone={() => setAdding(false)} />
          )}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="w-full mt-1 py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition text-center"
            >
              + Add manual account
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountsPageClient({
  accounts,
  history,
  userId,
}: {
  accounts: UnifiedAccount[]
  history: BalancePoint[]
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [period, setPeriod] = useState(90)
  const [open, setOpen] = useState({ cash: true, investments: true, credit: true })

  const handleUpdate = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('accounts').update(patch).eq('id', id)
    if (error) { toast.error('Failed to update: ' + error.message); return }
    router.refresh()
  }

  const handleArchive = async (id: string) => {
    await handleUpdate(id, { is_active: false })
  }

  const { cash, investments, credit, netWorthSeries, sparkMap, summary, currentNW, monthChange } = useMemo(() => {
    const cash = accounts.filter(a => a.type === 'cash')
    const investments = accounts.filter(a => a.type === 'investment')
    const credit = accounts.filter(a => a.type === 'credit' || a.type === 'loan')

    const sparkMap = new Map<string, number[]>()
    for (const a of accounts) {
      const pts = history
        .filter(h => h.account_id === a.id)
        .sort((x, y) => x.date.localeCompare(y.date))
        .map(h => h.balance)
      sparkMap.set(a.id, pts)
    }

    const dateMap = new Map<string, Map<string, number>>()
    for (const h of history) {
      if (!dateMap.has(h.date)) dateMap.set(h.date, new Map())
      dateMap.get(h.date)!.set(h.account_id, h.balance)
    }
    const lastKnown = new Map<string, number>()
    const netWorthSeries = [...dateMap.keys()].sort().map(date => {
      const dayMap = dateMap.get(date)!
      for (const [id, bal] of dayMap) lastKnown.set(id, bal)
      const value = [...lastKnown.values()].reduce((s, v) => s + v, 0)
      return { date, value }
    })

    const assets = accounts.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
    const liabilities = accounts.filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)
    const investTotal = investments.reduce((s, a) => s + a.balance, 0)
    const cashTotal = cash.reduce((s, a) => s + a.balance, 0)
    const currentNW = assets - liabilities

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
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <AccountGroup label="Cash" groupKey="cash" accounts={cash} sparkMap={sparkMap}
            open={open.cash} onToggle={() => setOpen(o => ({ ...o, cash: !o.cash }))}
            userId={userId} onUpdate={handleUpdate} onArchive={handleArchive} />
          <AccountGroup label="Investments" groupKey="investment" accounts={investments} sparkMap={sparkMap}
            open={open.investments} onToggle={() => setOpen(o => ({ ...o, investments: !o.investments }))}
            userId={userId} onUpdate={handleUpdate} onArchive={handleArchive} />
          <AccountGroup label="Credit Cards" groupKey="credit" accounts={credit} sparkMap={sparkMap}
            open={open.credit} onToggle={() => setOpen(o => ({ ...o, credit: !o.credit }))}
            userId={userId} onUpdate={handleUpdate} onArchive={handleArchive} />
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
