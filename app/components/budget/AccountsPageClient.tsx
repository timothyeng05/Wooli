'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { ACCOUNT_TYPES, isAssetType, depreciatedValue, type AccountType } from '@/lib/budget/account-utils'
import type { HouseholdMember } from './transaction-types'
import { fmtSyncTime, fmtRelative } from '@/lib/budget/format-utils'
import { SIMPLEFIN_BALANCE_SYNC_ENABLED, SIMPLEFIN_TRANSACTION_SYNC_ENABLED } from '@/lib/budget/sync-config'
import SimplefinConnectButton from './SimplefinConnectButton'
import InstitutionLogo, { KNOWN_INSTITUTIONS } from './InstitutionLogo'
import { useToast } from '@/app/components/ui/ToastProvider'

// ── Vehicle depreciation ↔ recurring transaction sync ──────────────────────
// A vehicle's monthly depreciation is a real cost even though no cash moves,
// so it's represented as a normal (non-transfer) monthly recurring expense —
// reusing the existing Recurring feature's own cron generation instead of
// inventing a parallel mechanism. linked_account_id ties the rule back to the
// vehicle so edits/archiving keep it in sync instead of creating duplicates.
type SupabaseBrowserClient = ReturnType<typeof createClient>

async function findOrCreateDepreciationCategory(supabase: SupabaseBrowserClient, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .is('parent_id', null)
    .ilike('name', 'depreciation')
    .maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: 'Depreciation', color: '#64748b', icon: '📉', is_income: false, is_transfer: false, parent_id: null, sort_order: 999 })
    .select('id')
    .single()
  if (error || !created) return null
  return created.id
}

function nextMonthlyDate(dayOfMonth: number): string {
  const today = new Date()
  const candidate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (candidate <= today) return new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth).toISOString().split('T')[0]
  return candidate.toISOString().split('T')[0]
}

async function upsertDepreciationRecurring(
  supabase: SupabaseBrowserClient, userId: string, accountId: string, vehicleName: string, monthlyAmount: number, purchaseDate: string
) {
  if (!(monthlyAmount > 0)) return
  const categoryId = await findOrCreateDepreciationCategory(supabase, userId)
  const dayOfMonth = new Date(purchaseDate + 'T12:00:00').getDate()

  const { data: existing } = await supabase
    .from('recurring_transactions')
    .select('id')
    .eq('linked_account_id', accountId)
    .maybeSingle()

  const payload = {
    user_id: userId,
    description: 'Depreciation',
    merchant: vehicleName,
    amount: -Math.abs(monthlyAmount),
    category_id: categoryId,
    frequency: 'monthly',
    day_of_month: dayOfMonth,
    is_active: true,
    linked_account_id: accountId,
  }
  if (existing) {
    await supabase.from('recurring_transactions').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('recurring_transactions').insert({ ...payload, next_date: nextMonthlyDate(dayOfMonth) })
  }
}

async function deactivateDepreciationRecurring(supabase: SupabaseBrowserClient, accountId: string) {
  await supabase.from('recurring_transactions').update({ is_active: false }).eq('linked_account_id', accountId)
}

export interface UnifiedAccount {
  id: string
  name: string
  mask: string | null
  type: 'cash' | 'investment' | 'credit' | 'loan' | 'vehicle'
  rawType?: string
  institution: string | null
  balance: number
  owner: string | null
  updatedAt?: string | null
  source: 'synced' | 'manual'
  is_hidden?: boolean
  exclude_from_net_worth?: boolean
  nickname?: string | null
  sortOrder?: number
  purchasePrice?: number | null
  purchaseDate?: string | null
  depreciationMonths?: number | null
  residualValue?: number | null
  logoUrl?: string | null
  depreciationRecurringId?: string | null
  holdings?: { fundName: string; mixPct: number | null; returnPct: number | null; statementEnd: string }[]
}

const CATEGORY_OPTIONS: { value: '' | 'cash' | 'investment' | 'credit' | 'loan'; label: string }[] = [
  { value: '', label: 'Auto (from bank)' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'credit', label: 'Credit' },
  { value: 'loan', label: 'Loan' },
]

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

// YTD's cutoff (Jan 1) moves with the calendar rather than a fixed day count,
// so it's represented with the sentinel -1 and resolved in cutoffForPeriod().
const YTD = -1
const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'YTD', days: YTD },
  { label: '1Y', days: 365 },
  { label: 'All', days: Infinity },
]

function cutoffForPeriod(period: number): string | null {
  if (period === Infinity) return null
  if (period === YTD) return new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  return new Date(Date.now() - period * 86400000).toISOString().split('T')[0]
}

// Types allowed per group
const GROUP_TYPES: Record<string, AccountType[]> = {
  cash: ['checking', 'savings', 'cash', 'other'],
  investment: ['investment'],
  vehicle: ['vehicle'],
  credit: ['credit', 'loan'],
}
const GROUP_DEFAULT: Record<string, AccountType> = {
  cash: 'checking',
  investment: 'investment',
  vehicle: 'vehicle',
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

// ── Net worth chart ───────────────────────────────────────────────────────────
const CW = 600, CH = 108, PL = 56, PR = 16, PT = 10, PB = 24
const IW = CW - PL - PR, IH = CH - PT - PB

function PeriodPicker({ period, onPeriod }: { period: number; onPeriod: (d: number) => void }) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button key={p.label} onClick={() => onPeriod(p.days)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
            period === p.days ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
          }`}>{p.label}</button>
      ))}
    </div>
  )
}

function NetWorthChart({ series, period }: {
  series: { date: string; value: number }[]
  period: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  const cutoff = cutoffForPeriod(period)
  const pts = cutoff ? series.filter(p => p.date >= cutoff) : series

  if (pts.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
        Balance history builds automatically each time you visit — check back tomorrow to see a trend
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

// ── Synced account row (editable) ────────────────────────────────────────────
function SyncedAccountRow({ account, onUpdate, onHide, members }: {
  account: UnifiedAccount
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onHide: (id: string) => Promise<void>
  members: HouseholdMember[]
}) {
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(account.nickname || '')
  const [owner, setOwner] = useState(account.owner || '')
  // Synced accounts never actually have type 'vehicle' (manual-only), but the
  // shared UnifiedAccount union includes it — guard defensively.
  const [category, setCategory] = useState<'' | 'cash' | 'investment' | 'credit' | 'loan'>(
    account.type === 'vehicle' ? 'cash' : account.type
  )
  const [hidden, setHidden] = useState(account.is_hidden ?? false)
  const [excludeNW, setExcludeNW] = useState(account.exclude_from_net_worth ?? false)
  const [saving, setSaving] = useState(false)
  const isAsset = account.type !== 'credit' && account.type !== 'loan'
  const displayName = account.nickname || account.name

  const save = async () => {
    setSaving(true)
    try {
      await onUpdate(account.id, {
        nickname: nickname.trim() || null, owner: owner || null, is_hidden: hidden, exclude_from_net_worth: excludeNW,
        type_override: category || null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mx-3 my-1 border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Bank name</span>
          <p className="text-xs font-semibold text-gray-700">{account.name}</p>
          {account.mask && <span className="text-xs text-gray-400">···{account.mask}</span>}
          <span className="text-[10px] text-gray-400 ml-1">Balance synced from your bank</span>
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
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as typeof category)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-0.5">Overrides which group (Cash/Investments/Credit Cards) this account sits under. SimpleFin doesn't report an account type, so set this to classify the account correctly.</p>
        </div>
        <div className="border-t border-gray-100 pt-2.5 space-y-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Visibility</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-800">Hide account &amp; its transactions</p>
              <p className="text-[11px] text-gray-400">Hides it here, and keeps its transactions out of the list, review queue and every report. Balance still counts toward net worth.</p>
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
      className={`group flex items-center gap-3 px-3 py-3 rounded-lg transition cursor-pointer ${
        account.is_hidden ? 'bg-gray-100 hover:bg-gray-200' : 'hover:bg-gray-50'
      }`}
      title="Click to edit"
    >
      <InstitutionLogo institution={account.institution} customUrl={account.logoUrl} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">
            {displayName}
            {account.mask && <span className="hidden sm:inline text-gray-400 font-normal"> ···{account.mask}</span>}
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
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">Synced</span>
          {account.mask && <span className="text-xs text-gray-400 sm:hidden">···{account.mask}</span>}
        </div>
        {account.holdings && account.holdings.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {account.holdings.map((h, i) => (
              <span key={h.fundName}>
                {i > 0 && ' · '}
                {h.fundName}
                {h.mixPct !== null && ` (${h.mixPct}%)`}
                {h.returnPct !== null && <span className={h.returnPct >= 0 ? 'text-green-500' : 'text-red-500'}> {h.returnPct >= 0 ? '+' : ''}{h.returnPct}%</span>}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
          isAsset || account.balance === 0 ? 'text-gray-900' : account.balance < 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {/* Credit/loan balance sign follows the synced convention: positive = owed, negative = credit in the cardholder's favor. */}
          {!isAsset && account.balance !== 0 ? (account.balance < 0 ? '+' : '-') : ''}${fmt(Math.abs(account.balance))}
        </p>
        {account.updatedAt && (
          <p className="text-[10px] text-gray-300 mt-0.5 whitespace-nowrap">{fmtRelative(account.updatedAt)}</p>
        )}
      </div>
    </div>
  )
}

// ── Manual account row (editable) ─────────────────────────────────────────────
function ManualAccountRow({ account, userId, onUpdate, onArchive, members }: {
  account: UnifiedAccount
  userId: string
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
  const isVehicle = type === 'vehicle'
  const [purchasePrice, setPurchasePrice] = useState(String(account.purchasePrice ?? ''))
  const [purchaseDate, setPurchaseDate] = useState(account.purchaseDate ?? new Date().toISOString().split('T')[0])
  const [depreciationMonths, setDepreciationMonths] = useState(String(account.depreciationMonths ?? '60'))
  const [residualValue, setResidualValue] = useState(String(account.residualValue ?? '0'))

  const isAsset = account.type !== 'credit' && account.type !== 'loan'
  const monthlyDepreciation = account.rawType === 'vehicle' && account.purchasePrice && account.depreciationMonths
    ? (account.purchasePrice - (account.residualValue ?? 0)) / account.depreciationMonths
    : null

  const save = async () => {
    setSaving(true)
    try {
      const newIsAsset = isAssetType(type)
      const vehicleFields = isVehicle
        ? {
            purchase_price: parseFloat(purchasePrice) || 0,
            purchase_date: purchaseDate,
            depreciation_months: parseInt(depreciationMonths, 10) || 1,
            residual_value: parseFloat(residualValue) || 0,
          }
        : {}
      const newBalance = isVehicle
        ? depreciatedValue(
            parseFloat(purchasePrice) || 0, purchaseDate,
            parseInt(depreciationMonths, 10) || 1, parseFloat(residualValue) || 0,
          )
        : parseFloat(balance) || 0
      await onUpdate(account.id, {
        name: name.trim(),
        institution: institution.trim() || null,
        current_balance: newBalance,
        type,
        is_asset: newIsAsset,
        owner: owner || null,
        exclude_from_net_worth: excludeNW,
        updated_at: new Date().toISOString(),
        ...vehicleFields,
      })

      const supabase = createClient()
      if (isVehicle) {
        const price = parseFloat(purchasePrice) || 0
        const months = parseInt(depreciationMonths, 10) || 1
        const residual = parseFloat(residualValue) || 0
        await upsertDepreciationRecurring(supabase, userId, account.id, name.trim(), (price - residual) / months, purchaseDate)
      } else if (account.rawType === 'vehicle') {
        // Type changed away from vehicle — stop generating depreciation expenses.
        await deactivateDepreciationRecurring(supabase, account.id)
      }

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
            <select value={institution} onChange={e => setInstitution(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
              <option value="">—</option>
              {institution && !KNOWN_INSTITUTIONS.includes(institution as typeof KNOWN_INSTITUTIONS[number]) && (
                <option value={institution}>{institution}</option>
              )}
              {KNOWN_INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
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
          {!isVehicle && (
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">Balance</label>
              <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
            </div>
          )}
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Owner</label>
            <select value={owner} onChange={e => setOwner(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
              <option value="">—</option>
              {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
            </select>
          </div>
        </div>
        {institution && (
          <p className="text-[10px] text-gray-400">
            To set a custom logo for {institution}, use{' '}
            <a href="/budget/settings/institutions" className="text-blue-600 hover:text-blue-700">Settings → Institutions</a>.
          </p>
        )}
        {isVehicle && (
          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2.5">
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">Purchase price</label>
              <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">Purchase date</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">Depreciate over (months)</label>
              <input type="number" step="1" min="1" value={depreciationMonths} onChange={e => setDepreciationMonths(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">Residual value</label>
              <input type="number" step="0.01" value={residualValue} onChange={e => setResidualValue(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
            </div>
            <p className="text-[10px] text-gray-400 col-span-2">Current balance is computed automatically from these values.</p>
          </div>
        )}
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
      <InstitutionLogo institution={account.institution} customUrl={account.logoUrl} size={36} />
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
          <span className="text-xs text-amber-500 font-medium flex-shrink-0">Manual</span>
          {monthlyDepreciation !== null && monthlyDepreciation > 0 && (
            <>
              <span className="text-xs text-gray-300">·</span>
              {account.depreciationRecurringId ? (
                <Link
                  href={`/budget/recurring/${account.depreciationRecurringId}`}
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-gray-400 hover:text-amber-600 hover:underline"
                >
                  -${fmt(monthlyDepreciation)}/mo
                </Link>
              ) : (
                <span className="text-xs text-gray-400">-${fmt(monthlyDepreciation)}/mo</span>
              )}
            </>
          )}
        </div>
        {account.holdings && account.holdings.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {account.holdings.map((h, i) => (
              <span key={h.fundName}>
                {i > 0 && ' · '}
                {h.fundName}
                {h.mixPct !== null && ` (${h.mixPct}%)`}
                {h.returnPct !== null && <span className={h.returnPct >= 0 ? 'text-green-500' : 'text-red-500'}> {h.returnPct >= 0 ? '+' : ''}{h.returnPct}%</span>}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
          isAsset || account.balance === 0 ? 'text-gray-900' : account.balance < 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {/* Credit/loan balance sign follows the synced convention: positive = owed, negative = credit in the cardholder's favor. */}
          {!isAsset && account.balance !== 0 ? (account.balance < 0 ? '+' : '-') : ''}${fmt(Math.abs(account.balance))}
        </p>
        {account.updatedAt && (
          <p className="text-[10px] text-gray-300 mt-0.5 whitespace-nowrap">{fmtRelative(account.updatedAt)}</p>
        )}
      </div>
    </div>
  )
}

// ── Inline add form ───────────────────────────────────────────────────────────
function AddAccountInlineForm({ groupKey, userId, onDone, members }: {
  groupKey?: 'cash' | 'investment' | 'vehicle' | 'credit'
  userId: string
  onDone: () => void
  members: HouseholdMember[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const allowedTypes = groupKey ? GROUP_TYPES[groupKey] : ACCOUNT_TYPES.map(t => t.value)
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [type, setType] = useState<AccountType>(groupKey ? GROUP_DEFAULT[groupKey] : 'checking')
  const [balance, setBalance] = useState('0')
  const [owner, setOwner] = useState('')
  const [saving, setSaving] = useState(false)
  const isVehicle = type === 'vehicle'
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [depreciationMonths, setDepreciationMonths] = useState('60')
  const [residualValue, setResidualValue] = useState('0')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const vehicleFields = isVehicle
        ? {
            purchase_price: parseFloat(purchasePrice) || 0,
            purchase_date: purchaseDate,
            depreciation_months: parseInt(depreciationMonths, 10) || 1,
            residual_value: parseFloat(residualValue) || 0,
          }
        : {}
      const startingBalance = isVehicle
        ? depreciatedValue(
            parseFloat(purchasePrice) || 0, purchaseDate,
            parseInt(depreciationMonths, 10) || 1, parseFloat(residualValue) || 0,
          )
        : parseFloat(balance) || 0
      const { data: newAccount, error } = await supabase.from('accounts').insert({
        user_id: userId,
        name: name.trim(),
        type,
        institution: institution.trim() || null,
        current_balance: startingBalance,
        is_asset: isAssetType(type),
        owner: owner || null,
        ...vehicleFields,
      }).select('id').single()
      if (error) throw error

      if (isVehicle && newAccount) {
        const price = parseFloat(purchasePrice) || 0
        const months = parseInt(depreciationMonths, 10) || 1
        const residual = parseFloat(residualValue) || 0
        await upsertDepreciationRecurring(supabase, userId, newAccount.id, name.trim(), (price - residual) / months, purchaseDate)
      }

      onDone()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={groupKey ? 'mx-3 my-2 border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2.5' : 'space-y-2.5'}>
      {groupKey && <p className="text-xs font-semibold text-gray-700">New account</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus
            placeholder="e.g. Chase Checking"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Institution</label>
          <select value={institution} onChange={e => setInstitution(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            <option value="">—</option>
            {KNOWN_INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
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
        {!isVehicle && (
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Balance</label>
            <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
        )}
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Owner</label>
          <select value={owner} onChange={e => setOwner(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            <option value="">—</option>
            {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
          </select>
        </div>
      </div>
      {isVehicle && (
        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2.5">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Purchase price</label>
            <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
              placeholder="e.g. 32000" required
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Purchase date</label>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Depreciate over (months)</label>
            <input type="number" step="1" min="1" value={depreciationMonths} onChange={e => setDepreciationMonths(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Residual value</label>
            <input type="number" step="0.01" value={residualValue} onChange={e => setResidualValue(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
          </div>
          <p className="text-[10px] text-gray-400 col-span-2">
            Value declines straight-line from purchase price to residual value over the period. Current balance is computed automatically.
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim() || (isVehicle && !purchasePrice)}
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

// ── Add account menu (Connect a bank / Add manually) ──────────────────────────
export function AddAccountMenu({ userId, members }: { userId: string; members: HouseholdMember[] }) {
  const [open, setOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
      >
        + Add account
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 z-20">
            <SimplefinConnectButton variant="menu-item" />
            <button
              onClick={() => { setOpen(false); setManualOpen(true) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition"
            >
              Add manually
            </button>
          </div>
        </>
      )}
      {manualOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={() => setManualOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Add manual account</p>
              <button onClick={() => setManualOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            <AddAccountInlineForm userId={userId} onDone={() => setManualOpen(false)} members={members} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Drag handle (grip dots) ────────────────────────────────────────────────
function DragHandle({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-3.5 h-3.5 flex-shrink-0 text-gray-300 group-hover:text-gray-400 transition-colors ${className}`}
      viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
      <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
      <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
    </svg>
  )
}

// Thin highlighted line marking where a dragged item would land.
function DropIndicator() {
  return <div className="h-0.5 mx-2 my-0.5 rounded-full bg-blue-500" />
}

// ── Account group ─────────────────────────────────────────────────────────────
function HiddenAccountsReveal({ hiddenAccounts, onUpdateSynced, onHideSynced, members }: {
  hiddenAccounts: UnifiedAccount[]
  onUpdateSynced: (id: string, patch: Record<string, unknown>) => Promise<void>
  onHideSynced: (id: string) => Promise<void>
  members: HouseholdMember[]
}) {
  const [showHidden, setShowHidden] = useState(false)
  if (hiddenAccounts.length === 0) return null
  const label = `${hiddenAccounts.length} hidden account${hiddenAccounts.length !== 1 ? 's' : ''}`
  const EyeIcon = () => (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
  return (
    <div className="mt-1">
      {!showHidden && (
        <button
          onClick={() => setShowHidden(true)}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          <EyeIcon />
          Show {label}
        </button>
      )}
      {showHidden && (
        <>
          {hiddenAccounts.map(a => (
            <SyncedAccountRow key={a.id} account={a} onUpdate={onUpdateSynced} onHide={onHideSynced} members={members} />
          ))}
          <button
            onClick={() => setShowHidden(false)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            <EyeIcon />
            Collapse {label}
          </button>
        </>
      )}
    </div>
  )
}

function AccountGroup({ label, groupKey, accounts, hiddenAccounts = [], open, onToggle, userId, onUpdateManual, onArchive, onUpdateSynced, onHideSynced, onReorder, members }: {
  label: string
  groupKey: 'cash' | 'investment' | 'vehicle' | 'credit'
  accounts: UnifiedAccount[]
  hiddenAccounts?: UnifiedAccount[]
  open: boolean
  onToggle: () => void
  userId: string
  onUpdateManual: (id: string, patch: Record<string, unknown>) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onUpdateSynced: (id: string, patch: Record<string, unknown>) => Promise<void>
  onHideSynced: (id: string) => Promise<void>
  onReorder: (orderedIds: string[]) => Promise<void>
  members: HouseholdMember[]
}) {
  // Local order lets a drag re-render instantly; re-synced whenever the
  // server-derived `accounts` prop changes (e.g. after the reorder persists).
  const [order, setOrder] = useState<string[]>(accounts.map(a => a.id))
  useEffect(() => { setOrder(accounts.map(a => a.id)) }, [accounts])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const byId = new Map(accounts.map(a => [a.id, a]))
  const orderedAccounts = order.map(id => byId.get(id)).filter((a): a is UnifiedAccount => !!a)

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return
    const next = order.filter(id => id !== draggingId)
    const targetIndex = next.indexOf(targetId)
    next.splice(targetIndex, 0, draggingId)
    setOrder(next)
    setDraggingId(null)
    setDragOverId(null)
    onReorder(next)
  }
  if (accounts.length === 0) {
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
        </div>
        {open && (
          <div className="ml-2 mt-0.5">
            <HiddenAccountsReveal hiddenAccounts={hiddenAccounts} onUpdateSynced={onUpdateSynced} onHideSynced={onHideSynced} members={members} />
          </div>
        )}
      </div>
    )
  }

  const isAsset = accounts[0]?.type !== 'credit' && accounts[0]?.type !== 'loan'
  const total = accounts.filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mb-1">
      <div onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition cursor-pointer">
        <div className="flex items-center gap-2 min-w-0">
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{label}</span>
          <span className="hidden sm:inline text-xs text-gray-400 flex-shrink-0">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-sm font-semibold whitespace-nowrap ${
            isAsset || total === 0 ? 'text-gray-900' : total < 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {!isAsset && total !== 0 ? (total < 0 ? '+' : '-') : ''}${fmt(Math.abs(total))}
          </span>
        </div>
      </div>
      {open && (
        <div className="ml-2 mt-0.5">
          {orderedAccounts.map(a => (
            <div
              key={a.id}
              draggable
              onDragStart={() => setDraggingId(a.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(a.id)}
              className={`cursor-grab active:cursor-grabbing ${draggingId === a.id ? 'opacity-40' : ''}`}
            >
              {a.source === 'manual'
                ? <ManualAccountRow account={a} userId={userId} onUpdate={onUpdateManual} onArchive={onArchive} members={members} />
                : <SyncedAccountRow account={a} onUpdate={onUpdateSynced} onHide={onHideSynced} members={members} />}
            </div>
          ))}
          <HiddenAccountsReveal hiddenAccounts={hiddenAccounts} onUpdateSynced={onUpdateSynced} onHideSynced={onHideSynced} members={members} />
        </div>
      )}
    </div>
  )
}

// ── Connection status strip ───────────────────────────────────────────────────
function ConnectionStatusStrip({ connections }: {
  connections: NonNullable<Parameters<typeof AccountsPageClient>[0]['connections']>
}) {
  if (!connections.length) return null
  const broken = connections.filter(c => c.status === 'error')

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {connections.map(connection => (
          <div key={connection.id} className="flex items-start sm:items-center gap-1.5 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1 sm:mt-0 ${
              connection.status === 'error' ? 'bg-red-500' : 'bg-green-500'
            }`} />
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 min-w-0">
              <span className="font-medium text-gray-700">{connection.institution_name ?? 'Unknown'}</span>
              {connection.status === 'error' ? (
                <span className="text-red-500">{connection.error_code ?? 'connection error'}</span>
              ) : connection.last_successful_sync_at ? (
                <span className="text-gray-400">{fmtSyncTime(connection.last_successful_sync_at)}</span>
              ) : null}
              {connection.status === 'error' && (
                <SimplefinConnectButton
                  connectionId={connection.id}
                  label="Reconnect"
                  className="sm:ml-1 self-start px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded hover:bg-red-100 transition disabled:opacity-50"
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {broken.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          A bank asked to be re-authenticated — transactions and balances for that institution pause until you reconnect.
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountsPageClient({
  accounts,
  netWorthHistory,
  userId,
  lastSynced,
  members = [],
  connections = [],
}: {
  accounts: UnifiedAccount[]
  netWorthHistory: { recorded_on: string; net_worth: number }[]
  userId: string
  lastSynced?: string | null
  members?: HouseholdMember[]
  connections?: {
    id: string
    institution_name: string | null
    status: string
    error_code: string | null
    error_message: string | null
    last_successful_sync_at: string | null
  }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [period, setPeriod] = useState(90)
  const [open, setOpen] = useState({ cash: true, investments: true, vehicles: true, credit: true })
  const [syncing, setSyncing] = useState(false)
  const [summaryMode, setSummaryMode] = useState<'totals' | 'percent'>('totals')
  // Pull transactions (when enabled) then refresh balances. Failures are
  // per-institution — report how many failed instead of all-or-nothing.
  const handleSync = async () => {
    setSyncing(true)
    try {
      if (SIMPLEFIN_TRANSACTION_SYNC_ENABLED) {
        const txRes = await fetch('/api/simplefin/sync-transactions', { method: 'POST' })
        const txBody = await txRes.json().catch(() => ({}))
        if (!txRes.ok) {
          toast.error(txBody.error ?? 'Transaction sync failed')
        } else {
          const failed = (txBody.connections ?? []).filter((i: { error?: unknown }) => i.error).length
          const total = (txBody.connections ?? []).length
          if (failed > 0) {
            toast.error(`${failed} of ${total} institution${total !== 1 ? 's' : ''} failed to sync`)
          } else if (txBody.added || txBody.merged || txBody.modified) {
            toast.success(`Synced ${txBody.added} new transaction${txBody.added !== 1 ? 's' : ''}`)
          }
        }
      }
      const balRes = await fetch('/api/simplefin/refresh-balances', { method: 'POST' })
      if (!balRes.ok) {
        toast.error('Balance refresh failed')
      } else {
        toast.success('Balances updated')
        router.refresh()
      }
    } catch {
      toast.error('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync once per page load if the last successful pull is over 4 hours
  // old. Nothing else pulls from SimpleFin on a schedule — the daily cron only
  // generates recurring transactions — so without this, balances sit stale
  // until someone remembers the Sync button. Once per visit, not a timer: a
  // page left open all day won't keep re-pulling.
  const autoSyncTriggered = useRef(false)
  useEffect(() => {
    if (autoSyncTriggered.current) return
    if (connections.length === 0) return
    const STALE_MS = 4 * 60 * 60 * 1000
    const isStale = !lastSynced || Date.now() - new Date(lastSynced).getTime() > STALE_MS
    if (!isStale) return
    autoSyncTriggered.current = true
    handleSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpdate = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('accounts').update(patch).eq('id', id)
    if (error) { toast.error('Failed to update: ' + error.message); return }
    router.refresh()
  }

  const handleArchive = async (id: string) => {
    await handleUpdate(id, { is_active: false })
    if (accounts.find(a => a.id === id)?.rawType === 'vehicle') {
      await deactivateDepreciationRecurring(supabase, id)
    }
  }

  const handleUpdateSynced = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('synced_accounts').update(patch).eq('provider_account_id', id)
    if (error) { toast.error('Failed to update: ' + error.message); return }
    router.refresh()
  }

  // Persist a new drag-and-drop order for one group. Manual and synced rows
  // share one visual list but live in separate tables, so split by source.
  const handleReorder = async (orderedIds: string[]) => {
    const bySource = new Map(accounts.map(a => [a.id, a.source]))
    await Promise.all(orderedIds.map((id, index) => {
      const source = bySource.get(id)
      return source === 'manual'
        ? supabase.from('accounts').update({ sort_order: index }).eq('id', id)
        : supabase.from('synced_accounts').update({ sort_order: index }).eq('provider_account_id', id)
    }))
    router.refresh()
  }

  const handleHideSynced = async (id: string) => {
    await handleUpdateSynced(id, { is_hidden: true })
  }

  const handleDownloadCsv = () => {
    const rows = [['Name', 'Type', 'Institution', 'Owner', 'Balance']]
    for (const a of accounts) {
      rows.push([
        a.nickname || a.name,
        a.type,
        a.institution ?? '',
        a.owner ?? '',
        a.balance.toFixed(2),
      ])
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const { cash, investments, vehicles, credit, hiddenAccounts, hiddenCash, hiddenInvestments, hiddenVehicles, hiddenCredit, netWorthSeries, summary, currentNW, monthChange } = useMemo(() => {
    const bySortOrder = (a: UnifiedAccount, b: UnifiedAccount) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    const active = accounts.filter(a => !a.is_hidden)
    const hiddenAccounts = accounts.filter(a => a.is_hidden)
    const cash = active.filter(a => a.type === 'cash').sort(bySortOrder)
    const investments = active.filter(a => a.type === 'investment').sort(bySortOrder)
    const vehicles = active.filter(a => a.type === 'vehicle').sort(bySortOrder)
    const credit = active.filter(a => a.type === 'credit' || a.type === 'loan').sort(bySortOrder)
    const hiddenCash = hiddenAccounts.filter(a => a.type === 'cash')
    const hiddenInvestments = hiddenAccounts.filter(a => a.type === 'investment')
    const hiddenVehicles = hiddenAccounts.filter(a => a.type === 'vehicle')
    const hiddenCredit = hiddenAccounts.filter(a => a.type === 'credit' || a.type === 'loan')

    // Net worth series from the dedicated net_worth_history table (assets - liabilities already computed)
    const netWorthSeries = netWorthHistory.map(r => ({ date: r.recorded_on, value: Number(r.net_worth) }))

    // Hidden accounts still count toward net worth — only exclude_from_net_worth removes them
    const counted = accounts.filter(a => !a.exclude_from_net_worth)
    const assets = counted.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
    // No Math.abs: a negative synced credit balance means the cardholder is in
    // credit (e.g. overpaid), which should reduce liabilities, not inflate them.
    const liabilities = counted.filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + a.balance, 0)
    const investTotal = [...investments, ...hiddenAccounts.filter(a => a.type === 'investment')]
      .filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)
    const cashTotal = [...cash, ...hiddenAccounts.filter(a => a.type === 'cash')]
      .filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)
    const vehicleTotal = [...vehicles, ...hiddenAccounts.filter(a => a.type === 'vehicle')]
      .filter(a => !a.exclude_from_net_worth).reduce((s, a) => s + a.balance, 0)
    const currentNW = assets - liabilities

    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const nwPastPt = [...netWorthSeries].reverse().find(p => p.date <= oneMonthAgo)
    const monthChange = nwPastPt ? currentNW - nwPastPt.value : 0

    return { cash, investments, vehicles, credit, hiddenAccounts, hiddenCash, hiddenInvestments, hiddenVehicles, hiddenCredit, netWorthSeries, currentNW, monthChange,
      summary: { assets, liabilities, investTotal, cashTotal, vehicleTotal, creditTotal: liabilities } }
  }, [accounts, netWorthHistory])

  const changePct = monthChange !== 0 && (currentNW - monthChange) !== 0
    ? Math.abs(monthChange / Math.abs(currentNW - monthChange) * 100).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Net worth header + chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-2 sm:gap-0 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Net Worth</p>
            <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{currentNW < 0 ? '-' : ''}${fmt(currentNW)}</p>
              {changePct && (
                <span className={`text-sm font-semibold ${monthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtShort(monthChange)} ({changePct}%) 1 month
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1.5">
            {SIMPLEFIN_BALANCE_SYNC_ENABLED && (
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Refresh balances"
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition disabled:opacity-50 group"
              >
                <svg className={`w-3 h-3 transition-transform ${syncing ? 'animate-spin' : 'group-hover:rotate-180 duration-300'}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                {syncing ? 'Syncing…' : lastSynced ? fmtSyncTime(lastSynced) : 'Sync now'}
              </button>
            )}
            <PeriodPicker period={period} onPeriod={setPeriod} />
          </div>
        </div>
        <NetWorthChart series={netWorthSeries} period={period} />
      </div>

      {/* Bank connection health */}
      <ConnectionStatusStrip connections={connections} />

      {/* Accounts + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <AccountGroup label="Cash" groupKey="cash" accounts={cash} hiddenAccounts={hiddenCash}
            open={open.cash} onToggle={() => setOpen(o => ({ ...o, cash: !o.cash }))}
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive} onReorder={handleReorder}
            onUpdateSynced={handleUpdateSynced} onHideSynced={handleHideSynced} members={members} />
          <AccountGroup label="Investments" groupKey="investment" accounts={investments} hiddenAccounts={hiddenInvestments}
            open={open.investments} onToggle={() => setOpen(o => ({ ...o, investments: !o.investments }))}
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive} onReorder={handleReorder}
            onUpdateSynced={handleUpdateSynced} onHideSynced={handleHideSynced} members={members} />
          <AccountGroup label="Vehicles" groupKey="vehicle" accounts={vehicles} hiddenAccounts={hiddenVehicles}
            open={open.vehicles} onToggle={() => setOpen(o => ({ ...o, vehicles: !o.vehicles }))}
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive} onReorder={handleReorder}
            onUpdateSynced={handleUpdateSynced} onHideSynced={handleHideSynced} members={members} />
          <AccountGroup label="Credit & Loans" groupKey="credit" accounts={credit} hiddenAccounts={hiddenCredit}
            open={open.credit} onToggle={() => setOpen(o => ({ ...o, credit: !o.credit }))}
            userId={userId} onUpdateManual={handleUpdate} onArchive={handleArchive} onReorder={handleReorder}
            onUpdateSynced={handleUpdateSynced} onHideSynced={handleHideSynced} members={members} />
          {accounts.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">No accounts connected yet</p>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Summary</p>
            <div className="flex bg-gray-100 rounded-md p-0.5">
              {(['totals', 'percent'] as const).map(mode => (
                <button key={mode} onClick={() => setSummaryMode(mode)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded transition capitalize ${
                    summaryMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm font-semibold text-gray-700">Assets</span>
                <span className="text-sm font-bold text-gray-900">${fmt(summary.assets)}</span>
              </div>
              <div className="w-full flex bg-gray-100 rounded-full h-1.5 mb-3 overflow-hidden">
                <div className="h-1.5 bg-blue-500" style={{ width: `${(summary.investTotal / (summary.assets || 1) * 100).toFixed(1)}%` }} />
                <div className="h-1.5 bg-green-500" style={{ width: `${(summary.cashTotal / (summary.assets || 1) * 100).toFixed(1)}%` }} />
                <div className="h-1.5 bg-amber-500" style={{ width: `${(summary.vehicleTotal / (summary.assets || 1) * 100).toFixed(1)}%` }} />
              </div>
              <div className="ml-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Investments
                  </span>
                  <span className="font-medium text-gray-700">
                    {summaryMode === 'totals' ? `$${fmt(summary.investTotal)}` : `${(summary.investTotal / (summary.assets || 1) * 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Cash
                  </span>
                  <span className="font-medium text-gray-700">
                    {summaryMode === 'totals' ? `$${fmt(summary.cashTotal)}` : `${(summary.cashTotal / (summary.assets || 1) * 100).toFixed(1)}%`}
                  </span>
                </div>
                {summary.vehicleTotal > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Vehicles
                    </span>
                    <span className="font-medium text-gray-700">
                      {summaryMode === 'totals' ? `$${fmt(summary.vehicleTotal)}` : `${(summary.vehicleTotal / (summary.assets || 1) * 100).toFixed(1)}%`}
                    </span>
                  </div>
                )}
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
                  <span className="text-gray-500">Credit & Loans</span>
                  <span className="font-medium text-gray-700">
                    {summaryMode === 'totals' ? `-$${fmt(summary.creditTotal)}` : `${(summary.creditTotal / (summary.liabilities || 1) * 100).toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadCsv}
            className="mt-4 pt-4 border-t border-gray-100 w-full text-xs font-medium text-blue-600 hover:text-blue-700 text-left"
          >
            Download CSV
          </button>
        </div>
      </div>
    </div>
  )
}
