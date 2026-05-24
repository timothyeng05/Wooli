'use client'

import { useState } from 'react'

interface DataPoint {
  recorded_on: string
  net_worth: number
  assets: number
  liabilities: number
}

interface Props {
  history: DataPoint[]
}

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: Infinity },
]

const W = 680
const H = 220
const PAD_L = 64
const PAD_R = 16
const PAD_T = 16
const PAD_B = 36
const CHART_W = W - PAD_L - PAD_R
const CHART_H = H - PAD_T - PAD_B

function formatK(val: number): string {
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function niceYBounds(min: number, max: number): { yMin: number; yMax: number; step: number } {
  const range = max - min || 1
  const rough = range / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = Math.ceil(rough / magnitude) * magnitude
  const yMin = Math.floor(min / step) * step
  const yMax = Math.ceil(max / step) * step
  return { yMin, yMax, step }
}

export default function NetWorthChart({ history }: Props) {
  const [period, setPeriod] = useState(90)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const filtered = history
    .filter(d => {
      if (period === Infinity) return true
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - period)
      return new Date(d.recorded_on + 'T00:00:00') >= cutoff
    })
    .sort((a, b) => a.recorded_on.localeCompare(b.recorded_on))

  if (filtered.length === 0) {
    return (
      <div className="space-y-3">
        <PeriodSelector period={period} onChange={setPeriod} />
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          No data for this period yet — visit daily to build your history.
        </div>
      </div>
    )
  }

  const values = filtered.map(d => d.net_worth)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const { yMin, yMax } = niceYBounds(rawMin, rawMax)
  const yRange = yMax - yMin || 1

  const toX = (i: number) =>
    PAD_L + (filtered.length === 1 ? CHART_W / 2 : (i / (filtered.length - 1)) * CHART_W)
  const toY = (val: number) => PAD_T + (1 - (val - yMin) / yRange) * CHART_H

  const points = filtered.map((d, i) => ({ x: toX(i), y: toY(d.net_worth) }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath =
    `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + CHART_H).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(PAD_T + CHART_H).toFixed(1)} Z`

  const latestNW = filtered[filtered.length - 1]?.net_worth ?? 0
  const isPositive = latestNW >= 0
  const lineColor = isPositive ? '#16a34a' : '#dc2626'
  const gradId = 'nw-grad'

  // Y-axis: 5 gridlines
  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + (yRange * i) / 4
    return { y: toY(val), label: formatK(val) }
  })

  // X-axis: up to 5 labels
  const xCount = Math.min(filtered.length, 5)
  const xLabels = Array.from({ length: xCount }, (_, i) => {
    const idx = xCount === 1 ? 0 : Math.round((i / (xCount - 1)) * (filtered.length - 1))
    return { x: toX(idx), label: formatDate(filtered[idx].recorded_on) }
  })

  const hovered = hoverIdx !== null ? filtered[hoverIdx] : null

  return (
    <div className="space-y-3">
      <PeriodSelector period={period} onChange={setPeriod} />

      <div className="relative">
        {hovered && hoverIdx !== null && (
          <div
            className="absolute z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg"
            style={{
              left: `${((points[hoverIdx].x - PAD_L) / (W - PAD_L - PAD_R)) * 100}%`,
              top: 4,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-semibold">{formatK(hovered.net_worth)}</p>
            <p className="text-gray-400">{formatDate(hovered.recorded_on)}</p>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 220 }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Gridlines + Y labels */}
          {yLabels.map((yl, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={yl.y} x2={W - PAD_R} y2={yl.y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={PAD_L - 6} y={yl.y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {yl.label}
              </text>
            </g>
          ))}

          {/* Zero line when range crosses 0 */}
          {yMin < 0 && yMax > 0 && (
            <line
              x1={PAD_L} y1={toY(0)} x2={W - PAD_R} y2={toY(0)}
              stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,3"
            />
          )}

          {/* Filled area */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Hover vertical line */}
          {hoverIdx !== null && (
            <line
              x1={points[hoverIdx].x} y1={PAD_T}
              x2={points[hoverIdx].x} y2={PAD_T + CHART_H}
              stroke="#d1d5db" strokeWidth="1"
            />
          )}

          {/* Data points — invisible hit targets */}
          {points.map((p, i) => (
            <rect
              key={i}
              x={i === 0 ? p.x : (points[i - 1].x + p.x) / 2}
              y={PAD_T}
              width={
                i === 0
                  ? (points[1]?.x ?? p.x + 10) / 2 - p.x / 2
                  : i === points.length - 1
                  ? p.x - (points[i - 1].x + p.x) / 2
                  : ((points[i + 1]?.x ?? p.x) - (points[i - 1]?.x ?? p.x)) / 2
              }
              height={CHART_H}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          ))}

          {/* Hover dot */}
          {hoverIdx !== null && (
            <circle
              cx={points[hoverIdx].x}
              cy={points[hoverIdx].y}
              r="4"
              fill={lineColor}
              stroke="white"
              strokeWidth="2"
            />
          )}

          {/* End dot (always visible) */}
          {hoverIdx === null && points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3"
              fill={lineColor}
            />
          )}

          {/* X-axis labels */}
          {xLabels.map((xl, i) => (
            <text key={i} x={xl.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {xl.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

function PeriodSelector({ period, onChange }: { period: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button
          key={p.label}
          onClick={() => onChange(p.days)}
          className={`px-3 py-1 text-sm rounded-md font-medium transition ${
            period === p.days
              ? 'bg-gray-900 text-white'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
