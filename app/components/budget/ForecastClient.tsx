'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useToast } from '@/app/components/ui/ToastProvider'

export interface IncomeStream {
  id: string
  name: string
  owner: string | null
  monthly_amount: number
  tax_rate: number
  growth_type: 'flat' | 'manual'
  growth_rate: number
  yearly_amounts: Record<string, number>
  sort_order: number
}

export interface ForecastSettings {
  expense_monthly: number
  expense_growth_rate: number
  investment_growth_rate: number
  tim_age: number | null
  tim_retirement_age: number | null
  jess_age: number | null
  jess_retirement_age: number | null
}

interface YearlyPoint {
  year: number
  netWorth: number
  income: number
  expenses: number
  investmentReturn: number
  goalDrawdowns: number
}

const THIS_YEAR = new Date().getFullYear()

function makeYears(timAge: number | null, jessAge: number | null): number[] {
  const yearsToTim80 = timAge ? 80 - timAge : null
  const yearsToJess80 = jessAge ? 80 - jessAge : null
  const horizon = Math.max(yearsToTim80 ?? 10, yearsToJess80 ?? 10, 10)
  return Array.from({ length: horizon + 1 }, (_, i) => THIS_YEAR + i)
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtK(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}

const OWNER_COLORS: Record<string, string> = {
  'Timothy Eng': '#3b82f6',
  'Jessica Li': '#f43f5e',
  'Shared': '#8b5cf6',
}
const OWNER_DISPLAY: Record<string, string> = {
  'Timothy Eng': 'Tim',
  'Jessica Li': 'Jess',
  'Shared': 'Shared',
}

// ── Projection ────────────────────────────────────────────────────────────────
function computeProjection({
  startingCash, startingInvestments, startingLiabilities,
  streams, expenseMonthly, expenseGrowthRate, investmentGrowthRate,
  goals, years, timRetirementYear, jessRetirementYear,
}: {
  startingCash: number
  startingInvestments: number
  startingLiabilities: number
  streams: IncomeStream[]
  expenseMonthly: number
  expenseGrowthRate: number
  investmentGrowthRate: number
  goals: { target_date: string | null; target_amount: number }[]
  years: number[]
  timRetirementYear: number | null
  jessRetirementYear: number | null
}): YearlyPoint[] {
  const points: YearlyPoint[] = []
  let cash = startingCash
  let investments = startingInvestments

  points.push({ year: THIS_YEAR, netWorth: cash + investments - startingLiabilities, income: 0, expenses: 0, investmentReturn: 0, goalDrawdowns: 0 })

  for (let i = 1; i < years.length; i++) {
    const year = years[i]

    const income = streams.reduce((s, st) => {
      // Zero out income after owner's retirement
      if (st.owner === 'Timothy Eng' && timRetirementYear && year > timRetirementYear) return s
      if (st.owner === 'Jessica Li' && jessRetirementYear && year > jessRetirementYear) return s
      if (st.growth_type === 'manual') {
        return s + (st.yearly_amounts[String(year)] ?? st.monthly_amount) * 12
      }
      return s + st.monthly_amount * Math.pow(1 + st.growth_rate / 100, i) * 12
    }, 0)

    const expenses = expenseMonthly * 12 * Math.pow(1 + expenseGrowthRate / 100, i)

    const goalDrawdowns = goals
      .filter(g => g.target_date && new Date(g.target_date + 'T12:00:00').getFullYear() === year)
      .reduce((s, g) => s + g.target_amount, 0)

    const investmentReturn = (cash + investments - startingLiabilities) * (investmentGrowthRate / 100)

    cash = cash + income - expenses - goalDrawdowns
    investments = investments + investmentReturn

    points.push({ year, netWorth: cash + investments - startingLiabilities, income, expenses, investmentReturn, goalDrawdowns })
  }

  return points
}

// ── Chart ─────────────────────────────────────────────────────────────────────
const CH = 240, PL = 60, PR = 20, PT = 16, PB = 32

interface ExplorerParams {
  startingCash: number
  startingInvestments: number
  startingLiabilities: number
  streams: IncomeStream[]
  expenseMonthly: number
  expenseGrowthRate: number
  investmentGrowthRate: number
  goals: { target_date: string | null; target_amount: number }[]
  years: number[]
}

function ForecastChart({ points, retirementMarkers, goals, explorerMode, explorerParams }: {
  points: YearlyPoint[]
  retirementMarkers: { year: number; label: string; color: string }[]
  goals: { target_date: string | null; target_amount: number; color: string; name: string }[]
  explorerMode: boolean
  explorerParams: ExplorerParams
}) {
  const [hover, setHover] = useState<number | null>(null)

  const CW = Math.max(800, points.length * 16)
  const IW = CW - PL - PR
  const IH = CH - PT - PB

  const allVals = [...points.map(p => p.netWorth), 0]
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1

  function xOf(i: number) { return PL + (i / (points.length - 1)) * IW }
  function yOf(v: number) { return PT + IH - ((v - minV) / range) * IH }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.netWorth).toFixed(1)}`).join(' ')

  // Explorer projection — recomputed on every hover in explorer mode
  const explorerProjection = explorerMode && hover !== null
    ? computeProjection({ ...explorerParams, timRetirementYear: points[hover].year, jessRetirementYear: points[hover].year })
    : null
  const explorerEndNW = explorerProjection?.[explorerProjection.length - 1]?.netWorth ?? 0
  const explorerGoesNegative = explorerProjection?.some(p => p.netWorth < 0) ?? false
  const explorerLinePath = explorerProjection
    ? explorerProjection.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.netWorth).toFixed(1)}`).join(' ')
    : null

  const step = Math.ceil(((maxV - minV) / 4) / 50000) * 50000 || 50000
  const yLabels: { v: number; y: number }[] = []
  for (let v = Math.floor(minV / step) * step; v <= Math.ceil(maxV / step) * step; v += step) {
    const y = yOf(v)
    if (y >= PT - 6 && y <= PT + IH + 6) yLabels.push({ v, y })
  }

  const hoverPt = hover !== null ? points[hover] : null
  const netChange = hoverPt ? hoverPt.income - hoverPt.expenses + hoverPt.investmentReturn - hoverPt.goalDrawdowns : 0

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: 'auto', cursor: explorerMode ? 'crosshair' : 'default' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = (e.clientX - rect.left) / rect.width * CW
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((px - PL) / IW) * (points.length - 1)))))
        }}>
        {yLabels.map(({ v, y }) => (
          <g key={v}>
            <line x1={PL} y1={y.toFixed(1)} x2={CW - PR} y2={y.toFixed(1)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: '#94a3b8' }}>
              {v < 0 ? '-' : ''}${fmtK(Math.abs(v))}
            </text>
          </g>
        ))}
        {/* Base projection line — dimmed in explorer mode */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          opacity={explorerMode ? 0.2 : 1} />
        {/* Explorer projection line */}
        {explorerLinePath && (
          <path d={explorerLinePath} fill="none"
            stroke={explorerGoesNegative ? '#ef4444' : '#f97316'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Goal dots on the line */}
        {!explorerMode && goals.filter(g => g.target_date).map((g, gi) => {
          const year = new Date(g.target_date! + 'T12:00:00').getFullYear()
          const idx = points.findIndex(p => p.year === year)
          if (idx <= 0) return null
          return (
            <circle key={`goal-${gi}`}
              cx={xOf(idx).toFixed(1)} cy={yOf(points[idx].netWorth).toFixed(1)}
              r="6" fill={g.color} stroke="white" strokeWidth="2" />
          )
        })}
        {/* Retirement triangles — dimmed in explorer mode */}
        {retirementMarkers.map(({ year, color }) => {
          const idx = points.findIndex(p => p.year === year)
          if (idx < 0) return null
          const cx = xOf(idx)
          const cy = yOf(points[idx].netWorth)
          return (
            <polygon key={`ret-${year}`}
              points={`${cx.toFixed(1)},${(cy - 11).toFixed(1)} ${(cx - 7).toFixed(1)},${(cy + 5).toFixed(1)} ${(cx + 7).toFixed(1)},${(cy + 5).toFixed(1)}`}
              fill={color} stroke="white" strokeWidth="2" strokeLinejoin="round"
              opacity={explorerMode ? 0.2 : 1} />
          )
        })}
        {/* Explorer retirement triangle at hovered year */}
        {explorerMode && hover !== null && (() => {
          const cx = xOf(hover)
          const explorerNW = explorerProjection?.[hover]?.netWorth ?? points[hover].netWorth
          const cy = yOf(explorerNW)
          return (
            <polygon
              points={`${cx.toFixed(1)},${(cy - 11).toFixed(1)} ${(cx - 7).toFixed(1)},${(cy + 5).toFixed(1)} ${(cx + 7).toFixed(1)},${(cy + 5).toFixed(1)}`}
              fill={explorerGoesNegative ? '#ef4444' : '#f97316'} stroke="white" strokeWidth="2" strokeLinejoin="round" />
          )
        })()}
        {/* X year labels */}
        {points.map((p, i) => {
          const isFirst = i === 0, isLast = i === points.length - 1, isHovered = i === hover
          if (!isFirst && !isLast && !isHovered && p.year % 5 !== 0) return null
          return (
            <text key={i} x={xOf(i).toFixed(1)} y={CH - 6} textAnchor="middle"
              style={{ fontSize: 10, fill: isHovered ? (explorerMode ? '#f97316' : '#3b82f6') : '#94a3b8', fontWeight: isHovered ? 600 : 400 }}>
              {p.year}
            </text>
          )
        })}
        {!explorerMode && hover !== null && (
          <>
            <line x1={xOf(hover).toFixed(1)} y1={PT} x2={xOf(hover).toFixed(1)} y2={PT + IH}
              stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={xOf(hover).toFixed(1)} cy={yOf(points[hover].netWorth).toFixed(1)} r="4"
              fill="#3b82f6" stroke="white" strokeWidth="2" />
          </>
        )}
      </svg>
      {hoverPt && hover !== null && (() => {
        if (explorerMode) {
          const retireYear = hoverPt.year
          const safe = !explorerGoesNegative
          return (
            <div className="absolute top-2 left-16 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm pointer-events-none text-xs space-y-1.5 min-w-[200px]">
              <p className="font-bold text-gray-900 text-sm">Retire in {retireYear}</p>
              <p className="text-gray-500">End net worth: <span className={`font-semibold ${safe ? 'text-gray-900' : 'text-red-500'}`}>${fmtK(explorerEndNW)}</span></p>
              <p className={`font-semibold flex items-center gap-1 ${safe ? 'text-green-600' : 'text-red-500'}`}>
                {safe ? '✓ Looks sustainable' : '✗ Net worth goes negative'}
              </p>
            </div>
          )
        }
        const retEvents = retirementMarkers.filter(m => m.year === hoverPt.year)
        const goalEvents = goals.filter(g => g.target_date && new Date(g.target_date + 'T12:00:00').getFullYear() === hoverPt.year)
        return (
          <div className="absolute top-2 left-16 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm pointer-events-none text-xs space-y-1 min-w-[160px]">
            <p className="font-bold text-gray-900 text-sm">{hoverPt.year}</p>
            <p className="text-blue-600 font-semibold">Net worth: ${fmtK(hoverPt.netWorth)}</p>
            {retEvents.map(m => (
              <p key={m.label} className="font-semibold" style={{ color: m.color }}>{m.label}</p>
            ))}
            {goalEvents.map((g, i) => (
              <p key={i} className="font-semibold" style={{ color: g.color }}>{g.name} — ${fmtK(g.target_amount)}</p>
            ))}
            {hover > 0 && <>
              <div className="border-t border-gray-100 pt-1 space-y-0.5">
                {hoverPt.income > 0 && <p className="text-gray-500">Income: +${fmtK(hoverPt.income)}</p>}
                {hoverPt.investmentReturn !== 0 && <p className="text-gray-500">Investment: +${fmtK(hoverPt.investmentReturn)}</p>}
                <p className="text-gray-500">Expenses: −${fmtK(hoverPt.expenses)}</p>
                {hoverPt.goalDrawdowns > 0 && <p className="text-amber-600">Goals: −${fmtK(hoverPt.goalDrawdowns)}</p>}
              </div>
              <p className={`font-semibold border-t border-gray-100 pt-1 ${netChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                Net flow: {netChange >= 0 ? '+' : '−'}${fmtK(Math.abs(netChange))}
              </p>
            </>}
          </div>
        )
      })()}
    </div>
  )
}

// ── Income stream form ────────────────────────────────────────────────────────
function StreamForm({
  initial,
  forecastYears,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<IncomeStream>
  forecastYears: number[]
  onSave: (data: Omit<IncomeStream, 'id' | 'sort_order'>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial.name ?? '')
  const [owner, setOwner] = useState(initial.owner ?? '')
  const [taxRate, setTaxRate] = useState(String(initial.tax_rate ?? 40))
  const [growthType, setGrowthType] = useState<'flat' | 'manual'>(initial.growth_type ?? 'flat')
  const [growthRate, setGrowthRate] = useState(String(initial.growth_rate ?? '3'))

  // UI works in pre-tax annual; storage is after-tax monthly — convert at boundaries
  const taxMult = () => 1 - (parseFloat(taxRate) || 40) / 100
  const [annual, setAnnual] = useState(String(
    initial.monthly_amount ? Math.round(initial.monthly_amount * 12 / ((1 - (initial.tax_rate ?? 40) / 100) || 1)) : ''
  ))
  const [yearlyAmounts, setYearlyAmounts] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {}
    const initTax = 1 - (initial.tax_rate ?? 40) / 100
    for (const y of forecastYears.slice(1)) {
      const existingMonthly = initial.yearly_amounts?.[String(y)]
      if (existingMonthly !== undefined) {
        base[String(y)] = String(Math.round(existingMonthly * 12 / (initTax || 1)))
      } else if (initial.monthly_amount) {
        const rate = (initial.growth_rate ?? 3) / 100
        const i = y - THIS_YEAR
        base[String(y)] = String(Math.round(initial.monthly_amount * 12 / (initTax || 1) * Math.pow(1 + rate, i)))
      } else {
        base[String(y)] = ''
      }
    }
    return base
  })

  const switchToManual = () => {
    const base: Record<string, string> = {}
    for (const y of forecastYears.slice(1)) {
      const i = y - THIS_YEAR
      const rate = (parseFloat(growthRate) || 3) / 100
      const preTaxAmt = parseFloat(annual) || 0
      base[String(y)] = String(Math.round(preTaxAmt * Math.pow(1 + rate, i)))
    }
    setYearlyAmounts(base)
    setGrowthType('manual')
  }

  const submit = () => {
    const tm = taxMult()
    const resolvedYearly: Record<string, number> = {}
    if (growthType === 'manual') {
      for (const y of forecastYears.slice(1)) {
        resolvedYearly[String(y)] = (parseFloat(yearlyAmounts[String(y)] || '0') || 0) * tm / 12
      }
    }
    onSave({
      name: name.trim(),
      owner: owner || null,
      tax_rate: parseFloat(taxRate) || 40,
      monthly_amount: (parseFloat(annual) || 0) * tm / 12,
      growth_type: growthType,
      growth_rate: parseFloat(growthRate) || 0,
      yearly_amounts: resolvedYearly,
    })
  }

  return (
    <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Stream name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder="e.g. Tim consulting"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Owner</label>
          <select value={owner} onChange={e => setOwner(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">—</option>
            <option value="Timothy Eng">Tim</option>
            <option value="Jessica Li">Jess</option>
            <option value="Shared">Shared</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Annual income (pre-tax)</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="1000" value={annual} onChange={e => setAnnual(e.target.value)}
              placeholder="231600"
              className="w-full pl-6 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          {annual && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              After tax: ${fmtK(Math.round((parseFloat(annual) || 0) * taxMult()))}/yr
            </p>
          )}
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Tax rate</label>
          <div className="relative">
            <input type="number" step="1" min="0" max="60" value={taxRate} onChange={e => setTaxRate(e.target.value)}
              className="w-full px-2.5 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Growth mode</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            <button type="button"
              onClick={() => setGrowthType('flat')}
              className={`flex-1 py-1.5 font-medium transition ${growthType === 'flat' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Flat rate
            </button>
            <button type="button"
              onClick={switchToManual}
              className={`flex-1 py-1.5 font-medium transition ${growthType === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              By year
            </button>
          </div>
        </div>
      </div>

      {growthType === 'flat' ? (
        <div className="max-w-[200px]">
          <label className="text-[11px] text-gray-500 mb-1 block">Annual growth rate</label>
          <div className="relative">
            <input type="number" step="0.5" value={growthRate} onChange={e => setGrowthRate(e.target.value)}
              className="w-full px-2.5 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          </div>
        </div>
      ) : (
        <div>
          <label className="text-[11px] text-gray-500 mb-2 block">Annual income by year (after tax)</label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {forecastYears.slice(1).map(y => (
              <div key={y} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10 flex-shrink-0">{y}</span>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input type="number" step="100"
                    value={yearlyAmounts[String(y)] ?? ''}
                    onChange={e => setYearlyAmounts(prev => ({ ...prev, [String(y)]: e.target.value }))}
                    className="w-full pl-5 pr-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving || !name.trim() || !annual}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-gray-500 text-xs hover:bg-gray-100 rounded-lg transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ForecastClient({
  streams: initial,
  settings: initialSettings,
  goals,
  startingCash,
  startingInvestments,
  startingLiabilities,
  userId,
  settingsExist,
}: {
  streams: IncomeStream[]
  settings: ForecastSettings
  goals: { target_date: string | null; target_amount: number; name: string; color: string }[]
  startingCash: number
  startingInvestments: number
  startingLiabilities: number
  userId: string
  settingsExist: boolean
}) {
  const { toast } = useToast()
  const supabase = createClient()

  const [streams, setStreams] = useState(initial)
  const [expenseAnnual, setExpenseAnnual] = useState(String(Math.round(initialSettings.expense_monthly * 12)))
  const [expenseGrowthRate, setExpenseGrowthRate] = useState(String(initialSettings.expense_growth_rate))
  const [investmentGrowthRate, setInvestmentGrowthRate] = useState(String(initialSettings.investment_growth_rate))
  const [timAge, setTimAge] = useState(String(initialSettings.tim_age ?? ''))
  const [timRetirementAge, setTimRetirementAge] = useState(String(initialSettings.tim_retirement_age ?? ''))
  const [jessAge, setJessAge] = useState(String(initialSettings.jess_age ?? ''))
  const [jessRetirementAge, setJessRetirementAge] = useState(String(initialSettings.jess_retirement_age ?? ''))
  const [addingStream, setAddingStream] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingStream, setSavingStream] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [explorerMode, setExplorerMode] = useState(false)

  const timAgeN = parseInt(timAge) || null
  const jessAgeN = parseInt(jessAge) || null
  const timRetirementAgeN = parseInt(timRetirementAge) || null
  const jessRetirementAgeN = parseInt(jessRetirementAge) || null

  const forecastYears = useMemo(() => makeYears(timAgeN, jessAgeN), [timAgeN, jessAgeN])

  const timRetirementYear = timAgeN && timRetirementAgeN ? THIS_YEAR + (timRetirementAgeN - timAgeN) : null
  const jessRetirementYear = jessAgeN && jessRetirementAgeN ? THIS_YEAR + (jessRetirementAgeN - jessAgeN) : null

  const retirementMarkers = [
    timRetirementYear ? { year: timRetirementYear, label: 'Tim retires', color: '#10b981' } : null,
    jessRetirementYear ? { year: jessRetirementYear, label: 'Jess retires', color: '#10b981' } : null,
  ].filter(Boolean) as { year: number; label: string; color: string }[]

  const projection = useMemo(() => computeProjection({
    startingCash,
    startingInvestments,
    startingLiabilities,
    streams,
    expenseMonthly: (parseFloat(expenseAnnual) || 0) / 12,
    expenseGrowthRate: parseFloat(expenseGrowthRate) || 0,
    investmentGrowthRate: parseFloat(investmentGrowthRate) || 0,
    goals,
    years: forecastYears,
    timRetirementYear,
    jessRetirementYear,
  }), [streams, expenseAnnual, expenseGrowthRate, investmentGrowthRate, startingCash, startingInvestments, startingLiabilities, goals, forecastYears, timRetirementYear, jessRetirementYear])

  const explorerParams: ExplorerParams = useMemo(() => ({
    startingCash,
    startingInvestments,
    startingLiabilities,
    streams,
    expenseMonthly: (parseFloat(expenseAnnual) || 0) / 12,
    expenseGrowthRate: parseFloat(expenseGrowthRate) || 0,
    investmentGrowthRate: parseFloat(investmentGrowthRate) || 0,
    goals,
    years: forecastYears,
  }), [streams, expenseAnnual, expenseGrowthRate, investmentGrowthRate, startingCash, startingInvestments, startingLiabilities, goals, forecastYears])

  const currentNW = projection[0]?.netWorth ?? 0
  const tenYearPt = projection.find(p => p.year === THIS_YEAR + 10)
  const tenYearNW = tenYearPt?.netWorth ?? projection[projection.length - 1]?.netWorth ?? 0
  const gain = tenYearNW - currentNW

  const handleAddStream = async (data: Omit<IncomeStream, 'id' | 'sort_order'>) => {
    setSavingStream(true)
    try {
      const { data: row, error } = await supabase
        .from('forecast_income_streams')
        .insert({ user_id: userId, sort_order: streams.length, ...data })
        .select()
        .single()
      if (error) throw error
      setStreams(prev => [...prev, row as IncomeStream])
      setAddingStream(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingStream(false)
    }
  }

  const handleEditStream = async (data: Omit<IncomeStream, 'id' | 'sort_order'>) => {
    if (!editingId) return
    setSavingStream(true)
    try {
      const { error } = await supabase.from('forecast_income_streams').update(data).eq('id', editingId)
      if (error) throw error
      setStreams(prev => prev.map(s => s.id === editingId ? { ...s, ...data } : s))
      setEditingId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingStream(false)
    }
  }

  const handleDeleteStream = async (id: string) => {
    try {
      await supabase.from('forecast_income_streams').delete().eq('id', id)
      setStreams(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const patch = {
        user_id: userId,
        expense_monthly: (parseFloat(expenseAnnual) || 0) / 12,
        expense_growth_rate: parseFloat(expenseGrowthRate) || 0,
        investment_growth_rate: parseFloat(investmentGrowthRate) || 0,
        tim_age: parseInt(timAge) || null,
        tim_retirement_age: parseInt(timRetirementAge) || null,
        jess_age: parseInt(jessAge) || null,
        jess_retirement_age: parseInt(jessRetirementAge) || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = settingsExist
        ? await supabase.from('forecast_settings').update(patch).eq('user_id', userId)
        : await supabase.from('forecast_settings').insert(patch)
      if (error) throw error
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Current net worth</p>
          <p className="text-2xl font-bold text-gray-900">${fmtK(currentNW)}</p>
        </div>
        <div className="text-gray-200 hidden sm:block">→</div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">In 10 years ({THIS_YEAR + 10})</p>
          <p className="text-2xl font-bold text-gray-900">${fmtK(tenYearNW)}</p>
        </div>
        <div className="text-gray-200 hidden sm:block">|</div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Projected gain</p>
          <p className={`text-2xl font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {gain >= 0 ? '+' : '−'}${fmtK(Math.abs(gain))}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-900">Net Worth Projection</p>
            <button
              onClick={() => setExplorerMode(m => !m)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                explorerMode
                  ? 'bg-orange-50 text-orange-600 border-orange-300'
                  : 'text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
              }`}
            >
              {explorerMode ? '✕ Exit explorer' : 'Retire explorer'}
            </button>
          </div>
          {!explorerMode && (
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0 ml-4">
              <div className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#3b82f6" strokeWidth="2.5" /></svg>
                Projection
              </div>
              {retirementMarkers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12"><polygon points="6,1 1,11 11,11" fill="#10b981" stroke="white" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                  Retirement
                </div>
              )}
              {goals.some(g => g.target_date) && (
                <div className="flex items-center gap-1.5">
                  <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#6366f1" stroke="white" strokeWidth="1.5" /></svg>
                  Goals
                </div>
              )}
            </div>
          )}
          {explorerMode && (
            <p className="text-xs text-orange-500 flex-shrink-0 ml-4">Hover to see retirement scenarios → orange = safe, red = goes negative</p>
          )}
        </div>
        <ForecastChart points={projection} retirementMarkers={retirementMarkers} goals={goals} explorerMode={explorerMode} explorerParams={explorerParams} />
      </div>

      {/* Income streams + Settings side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Income streams */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Income Streams</p>
          <div className="space-y-2 mb-3">
            {streams.map(s =>
              editingId === s.id ? (
                <StreamForm key={s.id} initial={s} forecastYears={forecastYears} onSave={handleEditStream} onCancel={() => setEditingId(null)} saving={savingStream} />
              ) : (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      {s.owner && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${OWNER_COLORS[s.owner] ?? '#6b7280'}18`, color: OWNER_COLORS[s.owner] ?? '#6b7280' }}>
                          {OWNER_DISPLAY[s.owner] ?? s.owner}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ${fmtK(s.monthly_amount * 12 / (1 - (s.tax_rate ?? 40) / 100))}/yr pre-tax
                      {s.growth_type === 'flat'
                        ? ` · +${s.growth_rate}%/yr`
                        : ' · custom by year'}
                    </p>
                  </div>
                  <button onClick={() => { setEditingId(s.id); setAddingStream(false) }}
                    className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</button>
                  <button onClick={() => handleDeleteStream(s.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition">✕</button>
                </div>
              )
            )}
            {streams.length === 0 && !addingStream && (
              <p className="text-sm text-gray-400 text-center py-4">No income streams yet</p>
            )}
          </div>
          {addingStream ? (
            <StreamForm initial={{}} forecastYears={forecastYears} onSave={handleAddStream} onCancel={() => setAddingStream(false)} saving={savingStream} />
          ) : (
            <button onClick={() => { setAddingStream(true); setEditingId(null) }}
              className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-xs font-medium text-gray-400 hover:border-blue-300 hover:text-blue-500 transition">
              + Add income stream
            </button>
          )}
        </div>

        {/* Expenses + Investment */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Annual Expenses</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Annual spend</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" step="1000" value={expenseAnnual} onChange={e => setExpenseAnnual(e.target.value)}
                    className="w-full pl-6 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Annual growth rate</label>
                <div className="relative">
                  <input type="number" step="0.5" value={expenseGrowthRate} onChange={e => setExpenseGrowthRate(e.target.value)}
                    className="w-full px-2.5 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Investments</p>
            <div className="mb-3 flex items-baseline gap-1.5">
              <p className="text-lg font-bold text-gray-900">${fmt(startingInvestments)}</p>
              <p className="text-xs text-gray-400">current balance</p>
            </div>
            <div className="max-w-[180px]">
              <label className="text-[11px] text-gray-500 mb-1 block">Annual return rate</label>
              <div className="relative">
                <input type="number" step="0.5" value={investmentGrowthRate} onChange={e => setInvestmentGrowthRate(e.target.value)}
                  className="w-full px-2.5 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* People */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">People</p>
            <div className="space-y-3">
              {[
                { label: 'Tim', age: timAge, setAge: setTimAge, retAge: timRetirementAge, setRetAge: setTimRetirementAge, retYear: timRetirementYear },
                { label: 'Jess', age: jessAge, setAge: setJessAge, retAge: jessRetirementAge, setRetAge: setJessRetirementAge, retYear: jessRetirementYear },
              ].map(({ label, age, setAge, retAge, setRetAge, retYear }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Current age</label>
                      <input type="number" min="1" max="100" value={age} onChange={e => setAge(e.target.value)}
                        placeholder="25"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Retirement age</label>
                      <input type="number" min="1" max="100" value={retAge} onChange={e => setRetAge(e.target.value)}
                        placeholder="65"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                  {retYear && (
                    <p className="text-[11px] text-green-600 mt-1">Retires in {retYear} · income streams stop then</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {goals.length > 0 && (
            <div className="border-t border-gray-100 pt-5">
              <p className="text-sm font-semibold text-gray-900 mb-2">Goal Drawdowns</p>
              <p className="text-xs text-gray-400 mb-2">Pulled from your Goals page — shown as drops on the chart.</p>
              <div className="space-y-1">
                {goals.filter(g => g.target_date).map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{g.name}</span>
                    <span className="text-gray-500">${fmt(g.target_amount)} · {new Date(g.target_date! + 'T12:00:00').getFullYear()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <button onClick={handleSaveSettings} disabled={savingSettings}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition">
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
