'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { ACCOUNT_TYPES, isAssetType, type AccountType } from '@/lib/budget/account-utils'
import type { HouseholdMember } from './transaction-types'
import { fmtSyncTime } from '@/lib/budget/format-utils'
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
  is_hidden?: boolean
  exclude_from_net_worth?: boolean
  nickname?: string | null
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
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
  const dataMin = Math.min(...vals), dataMax = Math.max(...vals)
  const dataRange = dataMax - dataMin || Math.abs(dataMax) * 0.05 || 1
  // Pad 20% above and below so the line doesn't fill the full chart height
  const yPad = dataRange * 0.20
  const minV = dataMin - yPad, maxV = dataMax + yPad
  const range = maxV - minV
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
      <div className="relative w-full" style={{ aspectRatio: `${CW} / ${CH}` }}>
        <svg viewBox={`0 0 ${CW} ${CH}`} className="absolute inset-0 w-full h-full"
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

// ── Plaid account row (editable) ─────────────────────────────────────────────
function PlaidAccountRow({ account, sparkValues, onUpdate, onHide, members }: {
  account: UnifiedAccount
  sparkValues: number[]
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onHide: (id: string) => Promise<void>
  members: HouseholdMember[]
}) {
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(account.nickname || '')
  const [owner, setOwner] = useState(account.owner || '')
  const [hidden, setHidden] = useState(account.is_hidden ?? false)
  const [excludeNW, setExcludeNW] = useState(account.exclude_from_net_worth ?? false)
  const [saving, setSaving] = useState(false)
  const isAsset = account.type !== 'credit' && account.type !== 'loan'
  const displayName = account.nickname || account.name

  const save = async () => {
    setSaving(true)
    try {
      await onUpdate(account.id, { nickname: nickname.trim() || null, owner: owner || null, is_hidden: hidden, exclude_from_net_worth: excludeNW })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mx-3 my-1 border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-gray-700">{account.name}</p>
          {account.mask && <span className="text-xs text-gray-400">···{account.mask}</span>}
          <span className="text-[10px] text-gray-400 ml-1">Balance synced from Plaid</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Nickname</label>
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder={account.name}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Owner</label>
            <select value={owner} onChange={e => setOwner(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
              <option value="">—</option>
              {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
            </select>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-2.5 space-y-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Visibility</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-800">Hide from list</p>
              <p className="text-[11px] text-gray-400">Removes account from the accounts view</p>
            </div>
            <Toggle checked={hidden} onChange={setHidden} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-800">Exclude from net worth</p>
              <p className="text-[11px] text-gray-400">Balance won't count toward totals or net worth</p>
            </div>
            <Toggle checked={excludeNW} onChange={setExcludeNW} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
            Save
          </button>
          <button onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-gray-500 rounded text-xs hover:bg-gray-100">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition cursor-pointer"
      title="Click to edit"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        isAsset ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
      }`}>
        {account.name.trim()[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">
            {displayName}
            {account.mask && <span className="text-gray-400 font-normal"> ···{account.mask}</span>}
          </p>
          {account.owner && (() => {
            const m = members.find(x => x.full_name === account.owner)
            return (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: m ? `${m.color}22` : '#f3f4f6', color: m?.color ?? '#6b7280' }}>
                {m?.display_name ?? account.owner}
              </span>
            )
          })()}
          {account.exclude_from_net_worth && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">excluded</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {account.institution && <p className="text-xs text-gray-400">{account.institution}</p>}
          <span className="text-[10px] text-gray-300 font-medium">Plaid</span>
        </div>
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
function ManualAccountRow({ account, sparkValues, onUpdate, onArchive, members }: {
  account: UnifiedAccount
  sparkValues: number[]
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onArchive: (id: string) => Promise<void>
  members: HouseholdMember[]
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.name)
  const [institution, setInstitution] = useState(account.institution || '')
  const [balance, setBalance] = useState(String(Math.abs(account.balance)))
  const [type, setType] = useState<AccountType>((account.rawType as AccountType) ?? 'checking')
  const [owner, setOwner] = useState(account.owner || '')
  const [excludeNW, setExcludeNW] = useState(account.exclude_from_net_worth ?? false)
  const [saving, setSaving] = useState(false)

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
        exclude_from_net_worth: excludeNW,
        updated_at: new Date().toISOString(),
      })
      setEditing(false)
    } finally {
      setSaving(false)
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
              {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
            </select>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-2.5 space-y-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Visibility</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-800">Exclude from net worth</p>
              <p className="text-[11px] text-gray-400">Balance won't count toward totals or net worth</p>
            </div>
            <Toggle checked={excludeNW} onChange={setExcludeNW} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
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
      onClick={() => setEditing(true)}
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
          {account.owner && (() => {
            const m = members.find(x => x.full_name === account.owner)
            return (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: m ? `${m.color}22` : '#f3f4f6', color: m?.color ?? '#6b7280' }}>
                {m?.display_name ?? account.owner}
              </span>
            )
          })()}
          {account.exclude_from_net_worth && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">excluded</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {account.institution && <p className="text-xs text-gray-400">{account.institution}</p>}
          <span className="text-[10px] text-amber-500 font-medium">Manual</span>
        </div>
        {account.updatedAt && (
          <p className="text-[10px] text-gray-300 mt-0.5">
            Updated {new Date(account.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Sparkline values={sparkValues} isAsset={isAsset} />
        <p className={`text-sm font-semibold tabular-nums w-28 text-right ${
          isAsset ? 'text-gray-900' : 'text-red-600'
        }`}>
          {isAsset ? '' : '-'}${fmt(Math.abs(account.balance))}
        </p>
      </div>
    </div>
  )
}

// ── Inline add form ───────────────────────────────────────────────────────────
function AddAccountInlineForm({ groupKey, userId, onDone, members }: {
  groupKey: 'cash' | 'investment' | 'credit'
  userId: string
  onDone: () => void
  members: HouseholdMember[]
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
            {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
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
function AccountGroup({ label, groupKey, accounts, sparkMap, open, onToggle, userId, onUpdateManual, onArchive, onUpdatePlaid, onHidePlaid, members }: {
  label: string
  groupKey: 'cash' | 'investment' | 'credit'
  accounts: UnifiedAccount[]
  sparkMap: Map<string, number[]>
  open: boolean
  onToggle: () => void
  userId: string
  onUpdateManual: (id: string, patch: Record<string, unknown>) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onUpdatePlaid: (id: string, patch: Record<string, unknown>) => Promise<void>
  onHidePlaid: (id: string) => Promise<void>
  members: HouseholdMember[]
}) {
  const [adding, setAdding] = useState(false)
  if (accounts.length === 0 && !adding) {
    return (
      <div className="mb-1">
        <div onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg transition cursor-pointer">
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
        </div>
        {adding && (
          <AddAccountInlineForm groupKey={groupKey} userId={userId} onDone={() => setAdding(false)} members={members} />
        )}
      </div>
    )
  }

  const isAsset = accounts[0]?.type !== 'credit' && accounts[0]?.type !== 'loan'
  const total = accounts.filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mb-1">
      <div onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg transition cursor-pointer">
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
      </div>
      {open && (
        <div className="ml-2 mt-0.5">
          {accounts.map(a =>
            a.source === 'manual'
              ? <ManualAccountRow key={a.id} account={a} sparkValues={sparkMap.get(a.id) ?? []} onUpdate={onUpdateManual} onArchive={onArchive} members={members} />
              : <PlaidAccountRow key={a.id} account={a} sparkValues={sparkMap.get(a.id) ?? []} onUpdate={onUpdatePlaid} onHide={onHidePlaid} members={members} />
          )}
          {adding && (
            <AddAccountInlineForm groupKey={groupKey} userId={userId} onDone={() => setAdding(false)} members={members} />
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

// ── Hidden accounts section ───────────────────────────────────────────────────
function HiddenAccountsSection({ accounts, sparkMap, onUpdate, onUnhide }: {
  accounts: UnifiedAccount[]
  sparkMap: Map<string, number[]>
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onUnhide: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const total = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hidden</span>
          <span className="text-xs text-gray-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-xs text-gray-400">${fmt(Math.abs(total))}</span>
      </button>
      {open && (
        <div className="ml-2 mt-0.5">
          {accounts.map(a => (
            <PlaidAccountRow key={a.id} account={a} sparkValues={sparkMap.get(a.id) ?? []} onUpdate={onUpdate} onHide={onUnhide} />
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
  netWorthHistory,
  userId,
  lastSynced,
  members = [],
  plaidItems = [],
}: {
  accounts: UnifiedAccount[]
  history: BalancePoint[]
  netWorthHistory: { recorded_on: string; net_worth: number }[]
  userId: string
  lastSynced?: string | null
  members?: HouseholdMember[]
  plaidItems?: { item_id: string; institution_name: string | null; default_owner: string | null }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [period, setPeriod] = useState(90)
  const [open, setOpen] = useState({ cash: true, investments: true, credit: true })
  const [syncing, setSyncing] = useState(false)
  const handleSync = async () => {
    setSyncing(true)
    try {
      const [txnRes, balRes] = await Promise.all([
        fetch('/api/plaid/sync-transactions', { method: 'POST' }),
        fetch('/api/plaid/refresh-balances', { method: 'POST' }),
      ])
      const txnData = await txnRes.json()
      if (!txnRes.ok || !balRes.ok) {
        toast.error(txnData.error ?? 'Sync failed')
      } else {
        toast.success(`Synced — ${txnData.added ?? 0} new transactions`)
        router.refresh()
      }
    } catch {
      toast.error('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  const handleUpdate = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('accounts').update(patch).eq('id', id)
    if (error) { toast.error('Failed to update: ' + error.message); return }
    if ('current_balance' in patch && typeof patch.current_balance === 'number') {
      const today = new Date().toISOString().split('T')[0]
      const accountName = accounts.find(a => a.id === id)?.name ?? ''
      await supabase.from('account_balance_history').upsert(
        { user_id: userId, account_id: id, account_name: accountName, date: today, balance: patch.current_balance },
        { onConflict: 'user_id,account_id,date' }
      )
    }
    router.refresh()
  }

  const handleArchive = async (id: string) => {
    await handleUpdate(id, { is_active: false })
  }

  const handleUpdatePlaid = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('plaid_accounts').update(patch).eq('account_id', id)
    if (error) { toast.error('Failed to update: ' + error.message); return }
    router.refresh()
  }

  const handleHidePlaid = async (id: string) => {
    await handleUpdatePlaid(id, { is_hidden: true })
  }

  const handleUnhidePlaid = async (id: string) => {
    await handleUpdatePlaid(id, { is_hidden: false })
  }

  const { cash, investments, credit, hiddenAccounts, netWorthSeries, sparkMap, summary, currentNW, monthChange } = useMemo(() => {
    const active = accounts.filter(a => !a.is_hidden)
    const hiddenAccounts = accounts.filter(a => a.is_hidden)
    const cash = active.filter(a => a.type === 'cash')
    const investments = active.filter(a => a.type === 'investment')
    const credit = active.filter(a => a.type === 'credit' || a.type === 'loan')

    const sparkMap = new Map<string, number[]>()
    for (const a of accounts) {
      const pts = history
        .filter(h => h.account_id === a.id)
        .sort((x, y) => x.date.localeCompare(y.date))
        .map(h => h.balance)
      sparkMap.set(a.id, pts)
    }

    // Net worth series from the dedicated net_worth_history table (assets - liabilities already computed)
    const netWorthSeries = netWorthHistory.map(r => ({ date: r.recorded_on, value: Number(r.net_worth) }))

    // Hidden accounts still count toward net worth — only exclude_from_net_worth removes them
    const counted = accounts.filter(a => !a.exclude_from_net_worth)
    const assets = counted.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
    const liabilities = counted.filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)
    const investTotal = [...investments, ...hiddenAccounts.filter(a => a.type === 'investment')]
      .filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)
    const cashTotal = [...cash, ...hiddenAccounts.filter(a => a.type === 'cash')]
      .filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)
    const currentNW = assets - liabilities

    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const pastPt = [...netWorthSeries].reverse().find(p => p.date <= oneMonthAgo)
    const monthChange = pastPt ? currentNW - pastPt.value : 0

    return { cash, investments, credit, hiddenAccounts, netWorthSeries, sparkMap, currentNW, monthChange,
      summary: { assets, liabilities, investTotal, cashTotal, creditTotal: liabilities } }
  }, [accounts, history, netWorthHistory])

  const changePct = monthChange !== 0 && (currentNW - monthChange) !== 0
    ? Math.abs(monthChange / Math.abs(currentNW - monthChange) * 100).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Net worth header + chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Net Worth</p>
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sync now"
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition disabled:opacity-50 group"
          >
            <svg className={`w-3 h-3 transition-transform ${syncing ? 'animate-spin' : 'group-hover:rotate-180 duration-300'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            {syncing ? 'Syncing…' : lastSynced ? fmtSyncTime(lastSynced) : 'Sync now'}
          </button>
        </div>
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
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive}
            onUpdatePlaid={handleUpdatePlaid} onHidePlaid={handleHidePlaid} members={members} />
          <AccountGroup label="Investments" groupKey="investment" accounts={investments} sparkMap={sparkMap}
            open={open.investments} onToggle={() => setOpen(o => ({ ...o, investments: !o.investments }))}
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive}
            onUpdatePlaid={handleUpdatePlaid} onHidePlaid={handleHidePlaid} members={members} />
          <AccountGroup label="Credit Cards" groupKey="credit" accounts={credit} sparkMap={sparkMap}
            open={open.credit} onToggle={() => setOpen(o => ({ ...o, credit: !o.credit }))}
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive}
            onUpdatePlaid={handleUpdatePlaid} onHidePlaid={handleHidePlaid} members={members} />
          {accounts.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">No accounts connected yet</p>
          )}
          {hiddenAccounts.length > 0 && (
            <HiddenAccountsSection
              accounts={hiddenAccounts}
              sparkMap={sparkMap}
              onUpdate={handleUpdatePlaid}
              onUnhide={handleUnhidePlaid}
            />
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
