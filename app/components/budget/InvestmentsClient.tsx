'use client'

import { useMemo } from 'react'
import type { HouseholdMember } from './transaction-types'
import { fmtMoney } from '@/lib/budget/format-utils'

export interface InvestmentHolding {
  fundName: string
  assetClass: string | null
  mixPct: number | null
  futureMixPct: number | null
  statementStart: string | null
  statementEnd: string
  // Period-style (e.g. Alight 401k statements): value at the start/end of
  // this statement window.
  openingBalance: number | null
  gainsLosses: number | null
  otherActivity: number | null
  closingBalance: number
  units: number | null
  fundPrice: number | null
  returnPct: number | null
  // Cost-basis style (e.g. Schwab brokerage statements): lifetime gain since
  // original purchase, unrelated to this statement's date range. Never
  // summed with the period fields above — they answer different questions.
  costBasis: number | null
  unrealizedGainLoss: number | null
}

export interface InvestmentAccount {
  id: string
  name: string
  institution: string | null
  owner: string | null
  balance: number
  source: 'manual' | 'synced'
  holdings: InvestmentHolding[]
}

interface Props {
  accounts: InvestmentAccount[]
  members: HouseholdMember[]
}

function fmtSigned(n: number) {
  return `${n < 0 ? '-' : ''}$${fmtMoney(n)}`
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function sumField<K extends 'gainsLosses' | 'unrealizedGainLoss' | 'costBasis'>(accounts: InvestmentAccount[], key: K) {
  return accounts.reduce((s, a) => s + a.holdings.reduce((hs, h) => hs + (h[key] ?? 0), 0), 0)
}

// ── Portfolio treemap ─────────────────────────────────────────────────────────
// Categorical slots 1-7 of the validated 8-hue palette (see the dataviz skill's
// palette.md) — worst adjacent CVD ΔE 9.1 light (≥8 target), worst adjacent
// normal-vision ΔE 19.6 light (≥15 floor). Slot 8 (red) is reserved so it never
// collides with the red/green gain-loss coloring used elsewhere on this page.
const ASSET_CLASS_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
// Same gray as the "Unassigned" owner bucket elsewhere in the budget module —
// a fold-in bucket is a non-answer, not a category, and reads that way.
const FOLD_COLOR = '#9ca3af'

interface AssetClassSlice { label: string; value: number; pct: number; color: string }

function buildAssetClassBreakdown(accounts: InvestmentAccount[]): AssetClassSlice[] {
  const totals = new Map<string, number>()
  for (const a of accounts) {
    for (const h of a.holdings) {
      const key = h.assetClass?.trim() || 'Unclassified'
      totals.set(key, (totals.get(key) ?? 0) + h.closingBalance)
    }
  }
  const sorted = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

  // Ladder from the dataviz skill: 7-8 is the token ceiling for adjacent
  // (touching) categorical marks — past it, fold the tail into "Other".
  const MAX_CLASSES = 7
  const shown = sorted.slice(0, MAX_CLASSES)
  const foldedTotal = sorted.slice(MAX_CLASSES).reduce((s, [, v]) => s + v, 0)
  if (foldedTotal > 0) shown.push(['Other', foldedTotal])

  const total = shown.reduce((s, [, v]) => s + v, 0)
  let slot = 0
  return shown.map(([label, value]) => ({
    label,
    value,
    pct: total > 0 ? (value / total) * 100 : 0,
    color: label === 'Unclassified' || label === 'Other' ? FOLD_COLOR : ASSET_CLASS_COLORS[slot++ % ASSET_CLASS_COLORS.length],
  }))
}

interface TreemapRect extends AssetClassSlice { x: number; y: number; w: number; h: number }

/** Squarified treemap (Bruls et al.) — lays out rectangles to keep aspect ratios near 1:1. */
function squarify(items: AssetClassSlice[], boxW: number, boxH: number): TreemapRect[] {
  const totalValue = items.reduce((s, i) => s + i.value, 0)
  if (totalValue <= 0) return []
  const scaled = items.map(i => ({ ...i, area: (i.value / totalValue) * boxW * boxH }))

  const worstRatio = (row: typeof scaled, side: number) => {
    const area = row.reduce((s, i) => s + i.area, 0)
    if (area === 0 || side === 0) return Infinity
    const maxA = Math.max(...row.map(i => i.area))
    const minA = Math.min(...row.map(i => i.area))
    return Math.max((side * side * maxA) / (area * area), (area * area) / (side * side * minA))
  }

  const rects: TreemapRect[] = []
  let remaining = scaled
  let [cx, cy, cw, ch] = [0, 0, boxW, boxH]

  while (remaining.length > 0) {
    const side = Math.min(cw, ch)
    let row = [remaining[0]]
    let rest = remaining.slice(1)
    while (rest.length > 0 && worstRatio(row, side) >= worstRatio([...row, rest[0]], side)) {
      row.push(rest[0])
      rest = rest.slice(1)
    }
    remaining = rest

    const rowArea = row.reduce((s, i) => s + i.area, 0)
    const rowThickness = side > 0 ? rowArea / side : 0

    if (cw >= ch) {
      let offset = cy
      for (const item of row) {
        const itemH = rowArea > 0 ? (item.area / rowArea) * ch : 0
        rects.push({ ...item, x: cx, y: offset, w: rowThickness, h: itemH })
        offset += itemH
      }
      cx += rowThickness
      cw -= rowThickness
    } else {
      let offset = cx
      for (const item of row) {
        const itemW = rowArea > 0 ? (item.area / rowArea) * cw : 0
        rects.push({ ...item, x: offset, y: cy, w: itemW, h: rowThickness })
        offset += itemW
      }
      cy += rowThickness
      ch -= rowThickness
    }
  }
  return rects
}

function srgbToLinear(c: number) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
function relativeLuminance(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}
/** White or ink text, whichever clears contrast against this fill — never a fixed color. */
function textColorFor(hex: string): string {
  const l = relativeLuminance(hex)
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return contrast(l, 1) >= contrast(l, 0) ? '#ffffff' : '#0b0b0b'
}

const TREEMAP_W = 1000
const TREEMAP_H = 380

function PortfolioTreemap({ accounts }: { accounts: InvestmentAccount[] }) {
  const items = useMemo(() => buildAssetClassBreakdown(accounts), [accounts])
  const rects = useMemo(() => squarify(items, TREEMAP_W, TREEMAP_H), [items])

  if (items.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-8">
      <p className="text-sm font-bold text-gray-900">Portfolio Diversification</p>
      <p className="text-xs text-gray-500 mb-4">By asset class, across every tracked account</p>

      <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: `${TREEMAP_W} / ${TREEMAP_H}` }}>
        {rects.map(r => {
          const pctW = (r.w / TREEMAP_W) * 100
          const pctH = (r.h / TREEMAP_H) * 100
          // Only place a label where it fits with room to spare — an unmeasured
          // label on a sliver cell just gets clipped or overflows its tile.
          const canLabel = pctW >= 12 && pctH >= 16
          const ink = textColorFor(r.color)
          return (
            <div
              key={r.label}
              className="absolute"
              style={{ left: `${(r.x / TREEMAP_W) * 100}%`, top: `${(r.y / TREEMAP_H) * 100}%`, width: `${pctW}%`, height: `${pctH}%` }}
              title={`${r.label} — ${fmtSigned(r.value)} (${r.pct.toFixed(1)}%)`}
            >
              {/* 1px inset on every cell = a 2px surface gap between neighbors, without a border's extra ink. */}
              <div className="absolute inset-[1px] rounded flex flex-col justify-end p-2 overflow-hidden" style={{ backgroundColor: r.color }}>
                {canLabel && (
                  <>
                    <span className="text-[11px] font-semibold truncate" style={{ color: ink }}>{r.label}</span>
                    <span className="text-[10px] truncate" style={{ color: ink, opacity: 0.85 }}>{fmtSigned(r.value)} · {r.pct.toFixed(0)}%</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend doubles as the table view — every slice's exact value, not just the ones with room to print on-tile. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
        {items.map(i => (
          <div key={i.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: i.color }} />
            <span className="text-gray-600">{i.label}</span>
            <span className="text-gray-400 font-mono tabular-nums">{fmtSigned(i.value)} · {i.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function InvestmentsClient({ accounts, members }: Props) {
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  const periodTracked = accounts.filter(a => a.holdings.some(h => h.gainsLosses !== null))
  const totalPeriodGain = sumField(periodTracked, 'gainsLosses')
  // Weighted by closing balance rather than opening balance: a fund that
  // received a mid-period transfer (e.g. reallocating out of a target-date
  // fund into another) can have an opening balance of $0, which would make
  // gains/opening divide by zero even though the provider's own fund_return_pct
  // is still meaningful.
  const returnWeights = periodTracked.flatMap(a => a.holdings.filter(h => h.returnPct !== null).map(h => ({ weight: h.closingBalance, returnPct: h.returnPct as number })))
  const totalReturnWeight = returnWeights.reduce((s, r) => s + r.weight, 0)
  const weightedReturnPct = totalReturnWeight > 0
    ? returnWeights.reduce((s, r) => s + r.returnPct * r.weight, 0) / totalReturnWeight
    : null
  const latestPeriodStatement = periodTracked
    .flatMap(a => a.holdings.filter(h => h.gainsLosses !== null).map(h => h.statementEnd))
    .sort()
    .at(-1)

  const costBasisTracked = accounts.filter(a => a.holdings.some(h => h.unrealizedGainLoss !== null))
  const totalUnrealizedGain = sumField(costBasisTracked, 'unrealizedGainLoss')
  const totalCostBasis = sumField(costBasisTracked, 'costBasis')
  const unrealizedReturnPct = totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : null

  const sorted = [...accounts].sort((a, b) => b.balance - a.balance)

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Investments</h1>
      <p className="text-sm text-gray-500 mb-6">
        Gain/loss across accounts with statement data uploaded. Accounts without a statement yet show balance only.
      </p>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${costBasisTracked.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 mb-8`}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500">Total invested</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-gray-900 mt-1">{fmtSigned(totalBalance)}</p>
          <p className="text-xs text-gray-400 mt-1">{accounts.length} account{accounts.length === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500">Period gain{latestPeriodStatement ? ` (through ${fmtDate(latestPeriodStatement)})` : ''}</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${periodTracked.length === 0 ? 'text-gray-400' : totalPeriodGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {periodTracked.length === 0 ? '—' : `${totalPeriodGain >= 0 ? '+' : ''}${fmtSigned(totalPeriodGain)}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {periodTracked.length === 0 ? 'No period statement yet' : `${periodTracked.length} account${periodTracked.length === 1 ? '' : 's'}, this statement window`}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500">Weighted return</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${weightedReturnPct === null ? 'text-gray-400' : weightedReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {weightedReturnPct === null ? '—' : `${weightedReturnPct >= 0 ? '+' : ''}${weightedReturnPct.toFixed(2)}%`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Period-tracked accounts only</p>
        </div>
        {costBasisTracked.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">Unrealized gain (vs. cost basis)</p>
            <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${totalUnrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalUnrealizedGain >= 0 ? '+' : ''}{fmtSigned(totalUnrealizedGain)}
              {unrealizedReturnPct !== null && <span className="text-sm font-normal ml-1">({unrealizedReturnPct >= 0 ? '+' : ''}{unrealizedReturnPct.toFixed(1)}%)</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">Lifetime, not this period — {costBasisTracked.length} account{costBasisTracked.length === 1 ? '' : 's'}</p>
          </div>
        )}
      </div>

      <PortfolioTreemap accounts={accounts} />

      <div className="space-y-3">
        {sorted.map(account => {
          const member = members.find(m => m.full_name === account.owner)
          const hasPeriod = account.holdings.some(h => h.gainsLosses !== null)
          const hasUnrealized = account.holdings.some(h => h.unrealizedGainLoss !== null)
          const periodGain = account.holdings.reduce((s, h) => s + (h.gainsLosses ?? 0), 0)
          const unrealizedGain = account.holdings.reduce((s, h) => s + (h.unrealizedGainLoss ?? 0), 0)
          return (
            <article key={account.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{account.name}</p>
                  {account.institution && <span className="text-xs text-gray-400 flex-shrink-0">· {account.institution}</span>}
                  {member && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${member.color}22`, color: member.color }}>
                      {member.display_name}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold font-mono tabular-nums text-gray-900">{fmtSigned(account.balance)}</p>
                  {hasPeriod && (
                    <p className={`text-xs font-mono tabular-nums ${periodGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {periodGain >= 0 ? '+' : ''}{fmtSigned(periodGain)} <span className="text-gray-400 font-sans">this period</span>
                    </p>
                  )}
                  {hasUnrealized && (
                    <p className={`text-xs font-mono tabular-nums ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {unrealizedGain >= 0 ? '+' : ''}{fmtSigned(unrealizedGain)} <span className="text-gray-400 font-sans">unrealized</span>
                    </p>
                  )}
                </div>
              </div>

              {account.holdings.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400 italic">No statement data yet — upload a statement to start tracking gains.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="font-medium px-4 py-2">Fund</th>
                        {/* asset_class and future_mix_pct were already fetched, typed
                            and passed down, then dropped at render — so allocation and
                            drift, the two things you'd actually rebalance against,
                            were invisible. */}
                        <th className="font-medium px-2 py-2">Class</th>
                        <th className="font-medium px-2 py-2 text-right">Mix</th>
                        <th className="font-medium px-2 py-2 text-right">Units</th>
                        <th className="font-medium px-2 py-2 text-right">Price</th>
                        <th className="font-medium px-2 py-2 text-right">Gain / loss</th>
                        <th className="font-medium px-4 py-2 text-right">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.holdings.map(h => {
                        const gain = h.gainsLosses ?? h.unrealizedGainLoss
                        const returnPct = h.returnPct ?? (h.unrealizedGainLoss !== null && h.costBasis ? (h.unrealizedGainLoss / h.costBasis) * 100 : null)
                        const label = h.gainsLosses !== null ? 'period' : h.unrealizedGainLoss !== null ? 'vs. cost basis' : null
                        return (
                          <tr key={h.fundName} className="border-t border-gray-50">
                            <td className="px-4 py-2 text-gray-700">{h.fundName}</td>
                            <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{h.assetClass ?? '—'}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-500">
                              {h.mixPct === null ? '—' : `${h.mixPct}%`}
                              {/* Only surface drift worth acting on — at a tighter
                                  threshold every rounding difference printed a target. */}
                              {h.mixPct !== null && h.futureMixPct !== null && Math.abs(h.futureMixPct - h.mixPct) >= 0.5 && (
                                <span className="block text-[10px] font-sans text-gray-400">target {h.futureMixPct}%</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-500">{h.units === null ? '—' : h.units.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-500">{h.fundPrice === null ? '—' : `$${fmtMoney(h.fundPrice)}`}</td>
                            <td className={`px-2 py-2 text-right font-mono tabular-nums ${gain === null ? 'text-gray-400' : gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {gain === null ? '—' : `${gain >= 0 ? '+' : ''}${fmtSigned(gain)}`}
                              {label && <span className="block text-[10px] font-sans text-gray-400">{label}</span>}
                            </td>
                            <td className={`px-4 py-2 text-right font-mono tabular-nums ${returnPct === null ? 'text-gray-400' : returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {returnPct === null ? '—' : `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )
        })}
        {accounts.length === 0 && (
          <p className="text-sm text-gray-400 italic">No investment accounts yet.</p>
        )}
      </div>
    </div>
  )
}
