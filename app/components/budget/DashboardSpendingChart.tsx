'use client'

import { useState } from 'react'

// CW tracks the rendered width so the plot fills its card — at 560 inside a
// wider container the chart scaled to fit and sat centred with dead margins.
const CW = 1100, CH = 160, PL = 52, PR = 12, PT = 10, PB = 32
const IW = CW - PL - PR, IH = CH - PT - PB

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export default function DashboardSpendingChart({
  thisMonth,
  lastMonth,
  today,
}: {
  thisMonth: number[]   // cumulative daily spend, index 0 = day 1
  lastMonth: number[]
  today: number         // 1-indexed current day
}) {
  const [hover, setHover] = useState<number | null>(null)

  const days = lastMonth.length // 28-31
  const maxVal = Math.max(...thisMonth, ...lastMonth, 1)

  function xOf(day: number) { return PL + ((day - 1) / (days - 1)) * IW }
  function yOf(v: number)   { return PT + IH - (v / maxVal) * IH }

  function linePath(data: number[], limit: number) {
    return data.slice(0, limit).map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i + 1).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  }
  function areaPath(data: number[], limit: number) {
    const line = linePath(data, limit)
    const lastX = xOf(limit).toFixed(1)
    return `${line} L${lastX},${(PT + IH).toFixed(1)} L${PL},${(PT + IH).toFixed(1)} Z`
  }

  const thisPath = linePath(thisMonth, today)
  const thisArea = areaPath(thisMonth, today)
  const lastPath = linePath(lastMonth, days)

  // Y axis
  const step = Math.ceil((maxVal / 3) / 1000) * 1000 || 1000
  const yLabels: { v: number; y: number }[] = []
  for (let v = 0; v <= maxVal + step; v += step) {
    const y = yOf(v)
    if (y >= PT - 4 && y <= PT + IH + 4) yLabels.push({ v, y })
  }

  // X labels: every ~7 days
  const xLabels: { label: string; x: number }[] = []
  for (let d = 1; d <= days; d += 7) xLabels.push({ label: `Day ${d}`, x: xOf(d) })

  const hoverThisVal  = hover !== null ? thisMonth[hover - 1] : null
  const hoverLastVal  = hover !== null ? lastMonth[hover - 1] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: CH }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = (e.clientX - rect.left) / rect.width * CW
          const d = Math.round(((px - PL) / IW) * (days - 1)) + 1
          setHover(Math.max(1, Math.min(days, d)))
        }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {yLabels.map(({ v, y }) => (
          <g key={v}>
            <line x1={PL} y1={y.toFixed(1)} x2={CW - PR} y2={y.toFixed(1)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 5} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: '#94a3b8' }}>{fmt(v)}</text>
          </g>
        ))}

        {/* Last month line (gray) */}
        <path d={lastPath} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* This month area + line (orange) */}
        <path d={thisArea} fill="url(#spendGrad)" />
        <path d={thisPath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {xLabels.map(({ label, x }) => (
          <text key={label} x={x.toFixed(1)} y={CH - 4} textAnchor="middle" style={{ fontSize: 10, fill: '#94a3b8' }}>{label}</text>
        ))}

        {hover !== null && (
          <line x1={xOf(hover).toFixed(1)} y1={PT} x2={xOf(hover).toFixed(1)} y2={PT + IH}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
        )}
        {hover !== null && hoverThisVal !== undefined && hover <= today && (
          <circle cx={xOf(hover).toFixed(1)} cy={yOf(hoverThisVal ?? 0).toFixed(1)} r="3.5"
            fill="#f97316" stroke="white" strokeWidth="2" />
        )}
        {hover !== null && hoverLastVal !== undefined && (
          <circle cx={xOf(hover).toFixed(1)} cy={yOf(hoverLastVal ?? 0).toFixed(1)} r="3.5"
            fill="#94a3b8" stroke="white" strokeWidth="2" />
        )}
      </svg>

      {/* Tooltip */}
      {hover !== null && (hoverThisVal != null || hoverLastVal != null) && (
        <div className="absolute top-1 left-14 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm pointer-events-none text-xs space-y-1">
          <p className="text-gray-400 font-medium">Day {hover}</p>
          {hover <= today && hoverThisVal != null && (
            <p className="text-orange-500 font-semibold">This month: {fmt(hoverThisVal)}</p>
          )}
          {hoverLastVal != null && (
            <p className="text-gray-500">Last month: {fmt(hoverLastVal)}</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 pl-14">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-gray-300" />
          <span className="text-[11px] text-gray-400">Last month</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-orange-400" />
          <span className="text-[11px] text-orange-500">This month</span>
        </div>
      </div>
    </div>
  )
}
