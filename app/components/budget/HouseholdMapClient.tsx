'use client'

import type { HouseholdMember } from './transaction-types'
import { fmtSyncTime, fmtMoney } from '@/lib/budget/format-utils'

export interface MapAccount {
  id: string
  name: string
  type: 'cash' | 'investment' | 'credit' | 'loan' | 'vehicle'
  institution: string | null
  balance: number
  owner: string | null
}

interface Props {
  accounts: MapAccount[]
  members: HouseholdMember[]
  avgMonthlySpend: number
  /** Max updated_at across synced accounts — null if nothing has ever synced. */
  lastSynced?: string | null
  hasSyncedAccounts?: boolean
}

/** Synced balances older than this are called out rather than shown bare. */
const STALE_SYNC_MS = 7 * 24 * 60 * 60 * 1000

interface Zone {
  key: string
  label: string
  color: string
  isJoint: boolean
  assets: MapAccount[]
  liabilities: MapAccount[]
  zeroCount: number
  net: number
}

const FALLBACK_JOINT_COLOR = '#9ca3af'
const ZERO_EPS = 0.005

function isAsset(type: MapAccount['type']) {
  return type !== 'credit' && type !== 'loan'
}

function fmtSigned(n: number) {
  return `${n < 0 ? '-' : ''}$${fmtMoney(n)}`
}
function fmtShort(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

function buildZone(key: string, label: string, color: string, isJoint: boolean, accts: MapAccount[]): Zone {
  const assetsAll = accts.filter(a => isAsset(a.type)).sort((a, b) => b.balance - a.balance)
  const liabAll = accts.filter(a => !isAsset(a.type)).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  const assets = assetsAll.filter(a => Math.abs(a.balance) >= ZERO_EPS)
  const liabilities = liabAll.filter(a => Math.abs(a.balance) >= ZERO_EPS)
  const zeroCount = (assetsAll.length - assets.length) + (liabAll.length - liabilities.length)
  const net = assetsAll.reduce((s, a) => s + a.balance, 0) - liabAll.reduce((s, a) => s + a.balance, 0)
  return { key, label, color, isJoint, assets, liabilities, zeroCount, net }
}

// Curve from the hub's bottom edge to a zone node's top edge — smooth for any
// horizontal offset, so it generalizes past the 2-personal-members layout.
function branchPath(x0: number, y0: number, x1: number, y1: number) {
  const c1x = x0 + (x1 - x0) * 0.15
  const c1y = y0 + (y1 - y0) * 0.55
  const c2x = x0 + (x1 - x0) * 0.85
  const c2y = y0 + (y1 - y0) * 0.3
  return `M ${x0} ${y0} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x1} ${y1}`
}

function severityClasses(sev: 'critical' | 'warn' | 'ok' | 'neutral') {
  switch (sev) {
    case 'critical': return { border: 'border-l-red-500', pill: 'bg-red-50 text-red-700' }
    case 'warn': return { border: 'border-l-amber-500', pill: 'bg-amber-50 text-amber-700' }
    case 'ok': return { border: 'border-l-green-500', pill: 'bg-green-50 text-green-700' }
    case 'neutral': return { border: 'border-l-gray-300', pill: 'bg-gray-100 text-gray-600' }
  }
}

function AccountRow({ account }: { account: MapAccount }) {
  const asset = isAsset(account.type)
  // Liabilities are stored positive (amount owed), so flip the sign for display.
  // Without this a $28k mortgage and $28k of cash render as the same string and
  // are told apart only by color — invisible on a mono display or to a
  // colorblind reader. Overpaid cards (negative balance) correctly read positive.
  const displayBalance = asset ? account.balance : -account.balance
  const colorClass = asset
    ? 'text-gray-900'
    : account.balance < 0 ? 'text-green-600' : 'text-red-600'
  return (
    <li className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-50">
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${asset ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="flex-1 min-w-0 truncate text-sm text-gray-700">
        {account.name}
        {account.institution && <span className="text-gray-400"> · {account.institution}</span>}
      </span>
      <span className={`text-sm font-mono tabular-nums whitespace-nowrap ${colorClass}`}>
        {fmtSigned(displayBalance)}
      </span>
    </li>
  )
}

export default function HouseholdMapClient({ accounts, members, avgMonthlySpend, lastSynced = null, hasSyncedAccounts = false }: Props) {
  const personalMembers = [...members].filter(m => !m.is_shared).sort((a, b) => a.sort_order - b.sort_order)
  const sharedMembers = members.filter(m => m.is_shared)
  const primaryShared = sharedMembers[0]

  const personalZones = personalMembers.map(m =>
    buildZone(m.id, m.display_name, m.color, false, accounts.filter(a => a.owner === m.full_name))
  )
  const jointAccounts = accounts.filter(a => sharedMembers.some(m => m.full_name === a.owner))
  const jointZone = buildZone(
    primaryShared?.id ?? 'joint',
    primaryShared?.display_name ?? 'Joint',
    primaryShared?.color ?? FALLBACK_JOINT_COLOR,
    true,
    jointAccounts,
  )

  const panelZones = [...personalZones, jointZone]
  const midIndex = Math.ceil(personalZones.length / 2)
  const hubZones = [...personalZones.slice(0, midIndex), jointZone, ...personalZones.slice(midIndex)]

  const assetsTotal = accounts.filter(a => isAsset(a.type)).reduce((s, a) => s + a.balance, 0)
  const liabilitiesTotal = accounts.filter(a => !isAsset(a.type)).reduce((s, a) => s + a.balance, 0)
  const householdNet = assetsTotal - liabilitiesTotal

  const cashBalance = accounts.filter(a => a.type === 'cash').reduce((s, a) => s + a.balance, 0)
  const investmentBalance = accounts.filter(a => a.type === 'investment').reduce((s, a) => s + a.balance, 0)

  // ── Signals ──────────────────────────────────────────────────────────────
  const signals: { name: string; sev: 'critical' | 'warn' | 'ok' | 'neutral'; pill: string; value: string; unit: string; body: string }[] = []

  if (avgMonthlySpend <= 0) {
    signals.push({ name: 'Cash liquidity', sev: 'neutral', pill: 'No data', value: '—', unit: '', body: 'Not enough transaction history yet to estimate monthly spend.' })
  } else {
    const months = cashBalance / avgMonthlySpend
    const sev = months < 1 ? 'critical' : months < 3 ? 'warn' : 'ok'
    const pill = months < 1 ? 'Tight' : months < 3 ? 'Thin' : 'Healthy'
    signals.push({
      name: 'Cash liquidity', sev, pill,
      value: months.toFixed(1), unit: 'months',
      body: `${fmtSigned(cashBalance)} in checking/savings covers ${months.toFixed(1)} months of the household's ${fmtSigned(avgMonthlySpend)} average monthly spend.`,
    })
  }

  if (avgMonthlySpend <= 0) {
    signals.push({ name: 'Runway with investments', sev: 'neutral', pill: 'No data', value: '—', unit: '', body: 'Not enough transaction history yet to estimate monthly spend.' })
  } else {
    const months = (cashBalance + investmentBalance) / avgMonthlySpend
    const sev = months < 3 ? 'critical' : months < 6 ? 'warn' : 'ok'
    const pill = months < 3 ? 'Tight' : months < 6 ? 'Building' : 'Solid'
    signals.push({
      name: 'Runway with investments', sev, pill,
      value: months.toFixed(1), unit: 'months',
      body: `Add investment balances (${fmtSigned(investmentBalance)}) to cash and the household could cover ${months.toFixed(1)} months if income stopped tomorrow — includes retirement accounts, which may carry early-withdrawal penalties.`,
    })
  }

  const topAsset = accounts.filter(a => isAsset(a.type)).sort((a, b) => b.balance - a.balance)[0]
  if (!topAsset || assetsTotal <= 0) {
    signals.push({ name: 'Concentration', sev: 'neutral', pill: 'No assets', value: '—', unit: '', body: 'No asset accounts yet.' })
  } else {
    const pct = (topAsset.balance / assetsTotal) * 100
    const sev = pct > 50 ? 'warn' : pct >= 25 ? 'neutral' : 'ok'
    const pill = pct > 50 ? 'Concentrated' : pct >= 25 ? 'Moderate' : 'Diversified'
    const ownerMember = members.find(m => m.full_name === topAsset.owner)
    const ownerLabel = ownerMember ? `${ownerMember.display_name}'s` : (topAsset.owner ? `${topAsset.owner}'s` : 'One')
    signals.push({
      name: 'Concentration', sev, pill,
      value: Math.round(pct).toString(), unit: '% of assets',
      body: `${ownerLabel} ${topAsset.name} alone is ${Math.round(pct)}% of household assets.`,
    })
  }

  if (householdNet <= 0) {
    signals.push({ name: 'Held jointly', sev: 'neutral', pill: 'N/A', value: '—', unit: '', body: 'Household net worth is zero or negative.' })
  } else {
    const pct = (Math.max(0, jointZone.net) / householdNet) * 100
    const sev = pct <= 0.5 ? 'warn' : 'neutral'
    const pill = pct <= 0.5 ? 'None joint' : 'Partial'
    signals.push({
      name: 'Held jointly', sev, pill,
      value: Math.round(pct).toString(), unit: '% of net worth',
      body: `${fmtSigned(jointZone.net)} of ${fmtSigned(householdNet)} sits in ${jointZone.label.toLowerCase()} accounts — the rest belongs to one person individually.`,
    })
  }

  // ── Hub diagram geometry ─────────────────────────────────────────────────
  const VBW = 900, VBH = 250
  const hubX = VBW / 2, hubY = 52, hubR = 38
  const nodeY = 200, nodeR = 30
  const margin = 150
  const n = hubZones.length
  const step = n > 1 ? (VBW - 2 * margin) / (n - 1) : 0
  const nodeX = (i: number) => (n === 1 ? hubX : margin + step * i)

  // Nothing pulls from SimpleFin on a schedule, so the page can't claim these
  // are live — it reports when the last sync actually landed, and says so
  // loudly once that's over a week old.
  const syncAgeMs = lastSynced ? Date.now() - new Date(lastSynced).getTime() : null
  const syncIsStale = syncAgeMs !== null && syncAgeMs > STALE_SYNC_MS

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Household Map</h1>
      </div>
      <p className="text-sm text-gray-500 mb-2">
        What each of you holds and owes, and how it rolls up to one household number.
      </p>
      <p className="text-sm mb-6">
        {!hasSyncedAccounts ? (
          <span className="text-gray-500">Balances are whatever you last entered by hand — nothing here syncs automatically.</span>
        ) : lastSynced ? (
          <span className={syncIsStale ? 'text-amber-700' : 'text-gray-500'}>
            {syncIsStale && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 mr-1.5 text-xs font-medium bg-amber-50 text-amber-700">
                Stale
              </span>
            )}
            Synced balances last updated {fmtSyncTime(lastSynced)}
            {syncIsStale && ' — sync from Accounts for current figures'}.
          </span>
        ) : (
          <span className="text-amber-700">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 mr-1.5 text-xs font-medium bg-amber-50 text-amber-700">
              Never synced
            </span>
            These accounts have never pulled a balance — figures below may be empty or wrong.
          </span>
        )}
      </p>

      {/* Hub diagram */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6 overflow-x-auto">
        <svg viewBox={`0 0 ${VBW} ${VBH}`} className="w-full h-auto min-w-[560px]" role="img"
          aria-label={`Household net worth of ${fmtSigned(householdNet)} splits across ${hubZones.map(z => `${z.label} (${fmtSigned(z.net)})`).join(', ')}.`}>
          <defs>
            {hubZones.map(z => (
              <marker key={z.key} id={`arrow-${z.key}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={z.color} />
              </marker>
            ))}
          </defs>

          {hubZones.map((z, i) => {
            const x1 = nodeX(i), y1 = nodeY - nodeR
            const path = branchPath(hubX, hubY + hubR, x1, y1)
            return (
              <path key={z.key} d={path} fill="none" stroke={z.color} strokeWidth={2}
                strokeDasharray={z.isJoint ? '4 4' : undefined}
                markerEnd={`url(#arrow-${z.key})`} />
            )
          })}

          {hubZones.map((z, i) => {
            const x = nodeX(i)
            const labelX = hubX + (x - hubX) * 0.4
            const labelY = hubY + hubR + (nodeY - nodeR - hubY - hubR) * 0.45
            return (
              // The label sits directly on top of its branch curve, so it needs a
              // white halo (stroke painted under the fill) to stay readable — at
              // 768px the SVG scales to ~0.78, and bare colored text on a
              // same-colored line was effectively invisible.
              <text key={z.key} x={labelX} y={labelY} textAnchor="middle" fontSize={13} fontWeight={600}
                stroke="#ffffff" strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill={z.color}>
                {fmtShort(z.net)}
              </text>
            )
          })}

          <circle cx={hubX} cy={hubY} r={hubR} fill="#eff2ff" stroke="#2f4fd8" strokeWidth={2} />
          <text x={hubX} y={hubY - 6} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#5c6472">HOUSEHOLD</text>
          <text x={hubX} y={hubY + 11} textAnchor="middle" fontSize={15} fontWeight={600} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#12151c">
            {fmtShort(householdNet)}
          </text>

          {hubZones.map((z, i) => {
            const x = nodeX(i)
            return (
              <g key={z.key}>
                <circle cx={x} cy={nodeY} r={nodeR} fill={`${z.color}1a`} stroke={z.color} strokeWidth={2}
                  strokeDasharray={z.isJoint ? '3 3' : undefined} />
                <text x={x} y={nodeY - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={z.color}>
                  {z.label.toUpperCase()}
                </text>
                <text x={x} y={nodeY + 11} textAnchor="middle" fontSize={12} fontWeight={600} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#12151c">
                  {fmtShort(z.net)}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="text-xs text-gray-400 text-center mt-1">
          Household net worth splits into each person&apos;s ledger and what&apos;s held jointly — each net of its own debt.
        </p>
      </div>

      {/* Signals */}
      <div className="mb-2">
        <h2 className="text-base font-bold text-gray-900">Signals</h2>
        <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
          Quick risk checks computed from your real balances and spend — not a full financial plan.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {signals.map(s => {
          const cls = severityClasses(s.sev)
          return (
            <div key={s.name} className={`bg-white border border-gray-200 border-l-4 ${cls.border} rounded-lg shadow-sm p-4`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700">{s.name}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls.pill}`}>{s.pill}</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2 mb-1.5">
                <span className="text-2xl font-bold font-mono tabular-nums text-gray-900">{s.value}</span>
                {s.unit && <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{s.unit}</span>}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{s.body}</p>
            </div>
          )
        })}
      </div>

      {/* Zone panels — 3-up only from lg. At md the three columns were narrow
          enough to truncate almost every account name ("High-Yield S…"). */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {panelZones.map(z => (
          <article key={z.key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-baseline justify-between gap-2 px-4 py-3.5 border-b border-gray-100">
              <span className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
                <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: z.color }} />
                {z.label}
              </span>
              <span className="text-sm font-semibold font-mono tabular-nums text-gray-900 whitespace-nowrap">{fmtSigned(z.net)}</span>
            </div>
            <div className="py-1 flex-1">
              {z.assets.length === 0 && z.liabilities.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 italic">Nothing held here yet.</p>
              ) : (
                <>
                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Assets</div>
                  {z.assets.length === 0 ? (
                    <p className="px-4 py-1 text-xs text-gray-400 italic">None</p>
                  ) : (
                    <ul className="px-2">{z.assets.map(a => <AccountRow key={a.id} account={a} />)}</ul>
                  )}

                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Liabilities</div>
                  {z.liabilities.length === 0 ? (
                    <p className="px-4 py-1 text-xs text-gray-400 italic">None</p>
                  ) : (
                    <ul className="px-2">{z.liabilities.map(a => <AccountRow key={a.id} account={a} />)}</ul>
                  )}

                  {z.zeroCount > 0 && (
                    <p className="px-4 pt-1.5 pb-1 text-xs text-gray-400 italic">+{z.zeroCount} more account{z.zeroCount === 1 ? '' : 's'} carrying $0</p>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
