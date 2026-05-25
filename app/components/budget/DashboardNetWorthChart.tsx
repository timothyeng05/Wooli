'use client'

import { useState } from 'react'

const CW = 560, CH = 140, PL = 52, PR = 12, PT = 10, PB = 28
const IW = CW - PL - PR, IH = CH - PT - PB

function fmtLabel(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toFixed(0)}`
}
function fmtFull(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function DashboardNetWorthChart({
  series,
}: {
  series: { date: string; value: number }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (series.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
        Builds automatically each visit — check back tomorrow
      </div>
    )
  }

  const values = series.map(p => p.value)
  const minV = Math.min(...values), maxV = Math.max(...values)
  const range = maxV - minV || 1

  function xOf(i: number) { return PL + (i / (series.length - 1)) * IW }
  function yOf(v: number) { return PT + IH - ((v - minV) / range) * IH }

  const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xOf(series.length - 1).toFixed(1)},${(PT + IH).toFixed(1)} L${PL},${(PT + IH).toFixed(1)} Z`

  const trendUp = series[series.length - 1].value >= series[0].value
  const lineColor = trendUp ? '#22c55e' : '#ef4444'
  const gradId = trendUp ? 'nwGradGreen' : 'nwGradRed'
  const stopColor = trendUp ? '#22c55e' : '#ef4444'

  // Y labels
  const step = Math.ceil(((maxV - minV) / 3) / 1000) * 1000 || 10000
  const yLabels: { v: number; y: number }[] = []
  for (let v = Math.floor(minV / step) * step; v <= maxV + step; v += step) {
    const y = yOf(v)
    if (y >= PT - 4 && y <= PT + IH + 4) yLabels.push({ v, y })
  }

  // X labels: first and last date
  const xLabels = [
    { label: series[0].date.slice(5), x: xOf(0) },
    { label: series[series.length - 1].date.slice(5), x: xOf(series.length - 1) },
  ]

  const hoverPt = hover !== null ? series[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: CH }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = (e.clientX - rect.left) / rect.width * CW
          const idx = Math.round(((px - PL) / IW) * (series.length - 1))
          setHover(Math.max(0, Math.min(series.length - 1, idx)))
        }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stopColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stopColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yLabels.map(({ v, y }) => (
          <g key={v}>
            <line x1={PL} y1={y.toFixed(1)} x2={CW - PR} y2={y.toFixed(1)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 5} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: '#94a3b8' }}>{fmtLabel(v)}</text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {xLabels.map(({ label, x }, i) => (
          <text key={i} x={x.toFixed(1)} y={CH - 4}
            textAnchor={i === 0 ? 'start' : 'end'}
            style={{ fontSize: 10, fill: '#94a3b8' }}>{label}</text>
        ))}

        {hover !== null && (
          <line x1={xOf(hover).toFixed(1)} y1={PT} x2={xOf(hover).toFixed(1)} y2={PT + IH}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
        )}
        {hoverPt && (
          <circle cx={xOf(hover!).toFixed(1)} cy={yOf(hoverPt.value).toFixed(1)} r="3.5"
            fill={lineColor} stroke="white" strokeWidth="2" />
        )}
      </svg>

      {hoverPt && (
        <div className="absolute top-1 left-14 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm pointer-events-none text-xs space-y-1">
          <p className="text-gray-400 font-medium">{hoverPt.date}</p>
          <p className="font-semibold text-gray-800">{fmtFull(hoverPt.value)}</p>
        </div>
      )}
    </div>
  )
}
