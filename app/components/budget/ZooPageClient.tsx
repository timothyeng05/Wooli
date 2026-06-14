'use client'

import { useState, useEffect } from 'react'

const STAGES = [
  { name: 'Ant',          emoji: '🐜', min: 0,           tier: 'pixel' },
  { name: 'Mouse',        emoji: '🐭', min: 1_000,       tier: 'pixel' },
  { name: 'Rabbit',       emoji: '🐰', min: 5_000,       tier: 'pixel' },
  { name: 'Cat',          emoji: '🐱', min: 10_000,      tier: 'pixel' },
  { name: 'Dog',          emoji: '🐶', min: 25_000,      tier: 'pixel' },
  { name: 'Fox',          emoji: '🦊', min: 50_000,      tier: 'pixel' },
  { name: 'Deer',         emoji: '🦌', min: 75_000,      tier: 'pixel' },
  { name: 'Wolf',         emoji: '🐺', min: 100_000,     tier: 'hd' },
  { name: 'Bear',         emoji: '🐻', min: 250_000,     tier: 'hd' },
  { name: 'Horse',        emoji: '🐴', min: 500_000,     tier: 'hd' },
  { name: 'Lion',         emoji: '🦁', min: 1_000_000,   tier: 'hd' },
  { name: 'Tiger',        emoji: '🐯', min: 2_500_000,   tier: 'hd' },
  { name: 'Elephant',     emoji: '🐘', min: 5_000_000,   tier: 'hd' },
  { name: 'Elder Dragon', emoji: '🐉', min: 10_000_000,  tier: 'hd' },
] as const

type Stage = (typeof STAGES)[number]

const THRESHOLDS = STAGES.map(s => s.min)
const STORAGE_KEY = 'wooli_zoo_stage'
const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C94']

// Stable confetti particles (generated once, not on every render)
const CONFETTI = Array.from({ length: 50 }, (_, i) => ({
  left:     (i * 37 + 13) % 100,
  delay:    (i * 0.07) % 1.5,
  duration: 1.5 + (i * 0.04) % 1.2,
  color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotation: (i * 47) % 360,
}))

function getStage(balance: number): number {
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (balance >= THRESHOLDS[i]) return i
  }
  return 0
}

function progressToNext(balance: number, stage: number): number {
  if (stage >= THRESHOLDS.length - 1) return 1.0
  return Math.min(
    (balance - THRESHOLDS[stage]) / (THRESHOLDS[stage + 1] - THRESHOLDS[stage]),
    1.0,
  )
}

function fmtFull(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 1_000)     return `$${Math.round(a / 1_000)}K`
  return `$${Math.round(a).toLocaleString()}`
}

interface Props {
  balance: number
  monthlyIncome: number
  monthlySpend: number
}

export default function ZooPageClient({ balance, monthlyIncome, monthlySpend }: Props) {
  const stage = getStage(balance)
  const progress = progressToNext(balance, stage)
  const current = STAGES[stage]
  const next = STAGES[stage + 1] as Stage | undefined
  const isHD = current.tier === 'hd'

  const [showOverlay, setShowOverlay] = useState(false)
  const [evolvedInto, setEvolvedInto] = useState<Stage>(current)

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? '-1', 10)
      if (stage > saved && saved >= 0) {
        setEvolvedInto(STAGES[stage])
        setShowOverlay(true)
        if ('vibrate' in navigator) navigator.vibrate(200)
      }
      localStorage.setItem(STORAGE_KEY, String(stage))
    } catch {
      // localStorage unavailable (private mode, etc.)
    }
  }, [stage])

  // Progress ring geometry
  const r = 40
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - progress)

  // Scene palette
  const skyTop    = isHD ? '#F59E0B' : '#0EA5E9'
  const skyBottom = isHD ? '#FDE68A' : '#BAE6FD'
  const groundTop = isHD ? '#CA8A04' : '#16A34A'
  const groundBot = isHD ? '#92400E' : '#15803D'
  const ringColor = isHD ? '#F59E0B' : '#3B82F6'
  const treeColor = isHD ? '#92400E' : '#15803D'
  const fenceClr  = isHD ? '#78350F' : '#92400E'

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        minHeight: '100dvh',
        background: `linear-gradient(to bottom, ${skyTop} 0%, ${skyBottom} 100%)`,
      }}
    >
      {/* CSS keyframe animations */}
      <style>{`
        @keyframes idleBounce {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes cloudDrift {
          0%, 100% { transform: translateX(0px); }
          50%       { transform: translateX(16px); }
        }
        @keyframes confettiFall {
          0%   { opacity: 1; transform: translateY(-20px) rotate(0deg); }
          100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes evolveIn {
          0%  { opacity: 0; transform: scale(0.3) translateY(20px); }
          60% { transform: scale(1.12) translateY(-4px); }
          100%{ opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* ── Scene: Sun ─────────────────────────────────────────────────────── */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 72, height: 72, top: 32, right: 32,
          background: isHD
            ? 'radial-gradient(circle at 40% 40%, #FEF3C7, #F59E0B)'
            : 'radial-gradient(circle at 40% 40%, #FFFDE7, #FCD34D)',
          boxShadow: `0 0 ${isHD ? 44 : 28}px ${isHD ? 'rgba(251,191,36,0.6)' : 'rgba(252,211,77,0.5)'}`,
        }}
      />

      {/* ── Scene: Clouds ──────────────────────────────────────────────────── */}
      <div
        className="absolute pointer-events-none"
        style={{ top: 54, left: '10%', animation: 'cloudDrift 9s ease-in-out infinite' }}
      >
        <CloudShape />
      </div>
      <div
        className="absolute pointer-events-none"
        style={{ top: 94, left: '54%', transform: 'scale(0.62)', animation: 'cloudDrift 13s ease-in-out 3s infinite' }}
      >
        <CloudShape />
      </div>

      {/* ── Scene: Ground ──────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '32%',
          background: `linear-gradient(to bottom, ${groundTop}, ${groundBot})`,
          borderRadius: '45% 45% 0 0 / 6% 6% 0 0',
        }}
      />

      {/* ── Scene: Trees ───────────────────────────────────────────────────── */}
      <div className="absolute pointer-events-none" style={{ bottom: '30%', left: 10 }}>
        <TreeShape color={treeColor} />
      </div>
      <div className="absolute pointer-events-none" style={{ bottom: '30%', right: 14, transform: 'scale(0.76)' }}>
        <TreeShape color={treeColor} />
      </div>

      {/* ── Scene: Fence ───────────────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: '28%' }}>
        <svg viewBox="0 0 400 44" width="100%" height="44" preserveAspectRatio="none">
          <rect x="0" y="8"  width="400" height="5" fill={fenceClr} rx="1" />
          <rect x="0" y="24" width="400" height="5" fill={fenceClr} rx="1" />
          {[0,1,2,3,4,5,6,7,8,9].map(i => (
            <rect key={i} x={i * 44 + 10} y="2" width="10" height="38" fill={fenceClr} rx="2" />
          ))}
        </svg>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{ minHeight: '100dvh', paddingBottom: 'max(88px, calc(80px + env(safe-area-inset-bottom)))' }}
      >
        {/* Stage badge */}
        <div
          className="mt-8 px-4 py-1.5 rounded-full text-xs font-bold border"
          style={{
            backdropFilter: 'blur(8px)',
            background: isHD ? 'rgba(254,243,199,0.85)' : 'rgba(224,242,254,0.85)',
            borderColor: isHD ? '#F59E0B' : '#38BDF8',
            color: isHD ? '#92400E' : '#0369A1',
          }}
        >
          Stage {stage} · {current.name}
        </div>

        {/* Animal hero + progress ring */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-2">
          <div className="relative" style={{ width: 148, height: 148 }}>
            {/* Ring track + progress */}
            <svg
              viewBox="0 0 100 100"
              width={148} height={148}
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5.5" />
              <circle
                cx="50" cy="50" r={r}
                fill="none"
                stroke={ringColor}
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dash}
                style={{
                  transition: 'stroke-dashoffset 0.7s ease',
                  filter: `drop-shadow(0 0 5px ${ringColor}99)`,
                }}
              />
            </svg>

            {/* Animal emoji */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                fontSize: '3.75rem',
                lineHeight: 1,
                animation: 'idleBounce 2.4s ease-in-out infinite',
                imageRendering: !isHD ? 'pixelated' : 'auto',
              }}
            >
              {current.emoji}
            </div>
          </div>

          {/* Progress label */}
          <p
            className="text-sm font-semibold drop-shadow text-center px-6"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            {next
              ? `${fmtShort(THRESHOLDS[stage + 1] - balance)} to ${next.name} ${next.emoji}`
              : '🌟 Max evolution — legendary!'}
          </p>

          {/* Stage dots minimap */}
          <div className="flex items-center gap-1 mt-1">
            {STAGES.map((s, i) => (
              <div
                key={i}
                title={`Stage ${i}: ${s.name}`}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i === stage ? 10 : 6,
                  height: i === stage ? 10 : 6,
                  background: i < stage
                    ? (isHD ? '#F59E0B' : '#38BDF8')
                    : i === stage
                      ? 'white'
                      : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Finance cards */}
        <div className="w-full px-4" style={{ maxWidth: 420 }}>
          <div className="grid grid-cols-3 gap-2">
            <FinanceCard
              label="Net Worth"
              value={fmtFull(balance)}
              negative={balance < 0}
              isHD={isHD}
            />
            <FinanceCard
              label="Income"
              value={fmtFull(monthlyIncome)}
              sub="this month"
              isHD={isHD}
            />
            <FinanceCard
              label="Spend"
              value={fmtFull(monthlySpend)}
              sub="this month"
              isHD={isHD}
            />
          </div>
        </div>
      </div>

      {/* ── Stage-up overlay ───────────────────────────────────────────────── */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowOverlay(false)}
        >
          {/* Confetti burst */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {CONFETTI.map((c, i) => (
              <div
                key={i}
                className="absolute w-2.5 h-2.5 rounded-sm"
                style={{
                  left: `${c.left}%`,
                  top: '-4%',
                  backgroundColor: c.color,
                  animation: `confettiFall ${c.duration}s ease-in ${c.delay}s both`,
                  transform: `rotate(${c.rotation}deg)`,
                }}
              />
            ))}
          </div>

          <div className="text-center px-6" style={{ animation: 'evolveIn 0.5s ease-out both' }}>
            <div style={{ fontSize: '7rem', lineHeight: 1, marginBottom: 16 }}>{evolvedInto.emoji}</div>
            <p
              className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Evolution!
            </p>
            <h2 className="text-3xl font-extrabold text-white mb-1">
              You&apos;re a {evolvedInto.name}!
            </h2>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Stage {stage} unlocked
            </p>
            <p className="text-sm mt-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Tap to continue
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CloudShape() {
  return (
    <svg width="92" height="48" viewBox="0 0 92 48">
      <ellipse cx="46" cy="38" rx="41" ry="12" fill="white" opacity="0.88" />
      <ellipse cx="32" cy="28" rx="21" ry="17" fill="white" opacity="0.92" />
      <ellipse cx="60" cy="26" rx="19" ry="16" fill="white" opacity="0.92" />
    </svg>
  )
}

function TreeShape({ color }: { color: string }) {
  return (
    <svg width="46" height="74" viewBox="0 0 46 74">
      <polygon points="23,2 46,47 0,47" fill={color} />
      <polygon points="23,18 44,58 2,58" fill={color} opacity="0.72" />
      <rect x="19" y="58" width="8" height="14" fill="#92400E" rx="1" />
    </svg>
  )
}

function FinanceCard({
  label, value, sub, isHD, negative,
}: {
  label: string
  value: string
  sub?: string
  isHD: boolean
  negative?: boolean
}) {
  return (
    <div
      className="rounded-xl p-2.5 text-center border border-white/10"
      style={{
        background: isHD ? 'rgba(120,53,15,0.55)' : 'rgba(3,105,161,0.45)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <p className="font-semibold uppercase tracking-wide text-white/55" style={{ fontSize: 9 }}>
        {label}
      </p>
      <p
        className="font-bold leading-tight mt-0.5"
        style={{ fontSize: 11, color: negative ? '#FCA5A5' : 'white' }}
      >
        {negative ? '-' : ''}{value}
      </p>
      {sub && (
        <p className="text-white/35 mt-0.5" style={{ fontSize: 9 }}>{sub}</p>
      )}
    </div>
  )
}
