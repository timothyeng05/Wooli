'use client'

import { useState, useEffect, useRef } from 'react'

// ── Stage definitions ─────────────────────────────────────────────────────────
const STAGES = [
  { name: 'Ant',          emoji: '🐜', min: 0,           tier: 'pixel', says: 'Every empire starts with one crumb. Keep saving! 🍂' },
  { name: 'Mouse',        emoji: '🐭', min: 1_000,       tier: 'pixel', says: 'Cheese is within reach. A little more and you\'ll hop ahead! 🧀' },
  { name: 'Rabbit',       emoji: '🐰', min: 5_000,       tier: 'pixel', says: 'Hoppin\' along! You\'re building great habits. 🥕' },
  { name: 'Cat',          emoji: '🐱', min: 10_000,      tier: 'pixel', says: 'Five figures? Purrfect. Time to aim higher. 🐾' },
  { name: 'Dog',          emoji: '🐶', min: 25_000,      tier: 'pixel', says: 'Good boy/girl! $25K is no small feat. Fetch that next level! 🦴' },
  { name: 'Fox',          emoji: '🦊', min: 50_000,      tier: 'pixel', says: 'Sly and savvy — half a hundred grand in the bank! 🌿' },
  { name: 'Deer',         emoji: '🦌', min: 75_000,      tier: 'pixel', says: 'Graceful and growing. The six-figure forest is near. 🍃' },
  { name: 'Wolf',         emoji: '🐺', min: 100_000,     tier: 'hd',    says: 'Six figures! You\'ve joined the pack. Lead the hunt! 🌕' },
  { name: 'Bear',         emoji: '🐻', min: 250_000,     tier: 'hd',    says: 'Quarter million strong. Hibernate smart, grow stronger. 🍯' },
  { name: 'Horse',        emoji: '🐴', min: 500_000,     tier: 'hd',    says: 'Half a million? You\'re galloping toward millionaire! 🌾' },
  { name: 'Lion',         emoji: '🦁', min: 1_000_000,   tier: 'hd',    says: 'Millionaire. The pride is yours. Roar! 🌅' },
  { name: 'Tiger',        emoji: '🐯', min: 2_500_000,   tier: 'hd',    says: 'Fierce and unstoppable. Multi-millionaire territory! 🔥' },
  { name: 'Elephant',     emoji: '🐘', min: 5_000_000,   tier: 'hd',    says: 'Never forgets. Never stops. Five million and counting. 🌍' },
  { name: 'Elder Dragon', emoji: '🐉', min: 10_000_000,  tier: 'hd',    says: 'Legendary. You have transcended mere finance. 🌟' },
] as const

type Stage = (typeof STAGES)[number]

const THRESHOLDS = STAGES.map(s => s.min)
const STORAGE_KEY = 'wooli_zoo_stage'
const CONFETTI_COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#FF8C94']

const CONFETTI = Array.from({ length: 50 }, (_, i) => ({
  left:     (i * 37 + 13) % 100,
  delay:    (i * 0.07) % 1.5,
  duration: 1.5 + (i * 0.04) % 1.2,
  color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotation: (i * 47) % 360,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  balance: number
  monthlyIncome: number
  monthlySpend: number
}

export default function ZooPageClient({ balance, monthlyIncome, monthlySpend }: Props) {
  const stage = getStage(balance)
  const progress = progressToNext(balance, stage)
  const current  = STAGES[stage]
  const next     = STAGES[stage + 1] as Stage | undefined
  const isHD     = current.tier === 'hd'

  const [showOverlay, setShowOverlay]     = useState(false)
  const [evolvedInto, setEvolvedInto]     = useState<Stage>(current)
  const [tapped, setTapped]               = useState(false)
  const [tapCount, setTapCount]           = useState(0)
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  // Scroll evolution strip to current stage on mount
  useEffect(() => {
    if (!stripRef.current) return
    const tile = stripRef.current.querySelector(`[data-stage="${stage}"]`) as HTMLElement
    if (tile) tile.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [stage])

  // Stage-up detection
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? '-1', 10)
      if (stage > saved && saved >= 0) {
        setEvolvedInto(STAGES[stage])
        setShowOverlay(true)
        if ('vibrate' in navigator) navigator.vibrate(200)
      }
      localStorage.setItem(STORAGE_KEY, String(stage))
    } catch { /* private mode */ }
  }, [stage])

  const handleAnimalTap = () => {
    setTapped(true)
    setTapCount(c => c + 1)
    if ('vibrate' in navigator) navigator.vibrate(40)
    setTimeout(() => setTapped(false), 500)
  }

  // SVG progress ring
  const r    = 38
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - progress)

  // Theme palette
  const skyTop    = isHD ? '#F59E0B' : '#0EA5E9'
  const skyBottom = isHD ? '#FDE68A' : '#BAE6FD'
  const groundTop = isHD ? '#CA8A04' : '#16A34A'
  const groundBot = isHD ? '#92400E' : '#15803D'
  const ringColor = isHD ? '#F59E0B' : '#3B82F6'
  const treeColor = isHD ? '#92400E' : '#15803D'
  const fenceClr  = isHD ? '#78350F' : '#92400E'

  // Spirit dialogue — changes after many taps
  const spiritText = tapCount > 5
    ? `Hehe, stop poking me! 😤 Save ${fmtShort(next ? THRESHOLDS[stage + 1] - balance : 0)} and I\'ll evolve!`
    : next
      ? progress > 0.8
        ? `So close! Just ${fmtShort(THRESHOLDS[stage + 1] - balance)} more! 🔥`
        : current.says
      : '🌟 You reached the pinnacle. Legendary!'

  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight: '100dvh', background: `linear-gradient(to bottom, ${skyTop} 0%, ${skyBottom} 100%)` }}
    >
      {/* CSS animations */}
      <style>{`
        @keyframes idleBounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes tapPop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.25) rotate(-8deg); }
          60%  { transform: scale(0.92) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes cloudDrift {
          0%,100% { transform: translateX(0); }
          50%      { transform: translateX(16px); }
        }
        @keyframes confettiFall {
          0%   { opacity:1; transform: translateY(-20px) rotate(0deg); }
          100% { opacity:0; transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes evolveIn {
          0%  { opacity:0; transform: scale(0.3) translateY(20px); }
          60% { transform: scale(1.12) translateY(-4px); }
          100%{ opacity:1; transform: scale(1) translateY(0); }
        }
        @keyframes dialoguePop {
          0%  { opacity:0; transform: scale(0.85) translateY(6px); }
          100%{ opacity:1; transform: scale(1) translateY(0); }
        }
        @keyframes shimmer {
          0%   { box-shadow: 0 0 0px 0px rgba(255,255,255,0.4); }
          50%  { box-shadow: 0 0 12px 4px rgba(255,255,255,0.7); }
          100% { box-shadow: 0 0 0px 0px rgba(255,255,255,0.4); }
        }
      `}</style>

      {/* ── Scene: Sun ── */}
      <div className="absolute rounded-full pointer-events-none" style={{
        width:72, height:72, top:28, right:28,
        background: isHD
          ? 'radial-gradient(circle at 40% 40%, #FEF3C7, #F59E0B)'
          : 'radial-gradient(circle at 40% 40%, #FFFDE7, #FCD34D)',
        boxShadow: `0 0 ${isHD?44:28}px ${isHD?'rgba(251,191,36,.6)':'rgba(252,211,77,.5)'}`,
      }}/>

      {/* ── Scene: Clouds ── */}
      <div className="absolute pointer-events-none" style={{top:54,left:'10%',animation:'cloudDrift 9s ease-in-out infinite'}}>
        <CloudShape/>
      </div>
      <div className="absolute pointer-events-none" style={{top:94,left:'54%',transform:'scale(0.6)',animation:'cloudDrift 13s ease-in-out 3s infinite'}}>
        <CloudShape/>
      </div>

      {/* ── Scene: Ground ── */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height:'34%',
        background:`linear-gradient(to bottom, ${groundTop}, ${groundBot})`,
        borderRadius:'45% 45% 0 0 / 6% 6% 0 0',
      }}/>

      {/* ── Scene: Trees ── */}
      <div className="absolute pointer-events-none" style={{bottom:'31%',left:8}}>
        <TreeShape color={treeColor}/>
      </div>
      <div className="absolute pointer-events-none" style={{bottom:'31%',right:12,transform:'scale(0.74)'}}>
        <TreeShape color={treeColor}/>
      </div>

      {/* ── Scene: Fence ── */}
      <div className="absolute left-0 right-0 pointer-events-none" style={{bottom:'29%'}}>
        <svg viewBox="0 0 400 44" width="100%" height="44" preserveAspectRatio="none">
          <rect x="0" y="8"  width="400" height="5" fill={fenceClr} rx="1"/>
          <rect x="0" y="24" width="400" height="5" fill={fenceClr} rx="1"/>
          {[0,1,2,3,4,5,6,7,8,9].map(i=>(
            <rect key={i} x={i*44+10} y="2" width="10" height="38" fill={fenceClr} rx="2"/>
          ))}
        </svg>
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-10 flex flex-col" style={{
        minHeight:'100dvh',
        paddingBottom:'max(90px, calc(80px + env(safe-area-inset-bottom)))',
      }}>

        {/* Stage badge */}
        <div className="flex justify-center mt-7">
          <div className="px-4 py-1.5 rounded-full text-xs font-bold border" style={{
            backdropFilter:'blur(8px)',
            background: isHD ? 'rgba(254,243,199,.85)' : 'rgba(224,242,254,.85)',
            borderColor: isHD ? '#F59E0B' : '#38BDF8',
            color:       isHD ? '#92400E' : '#0369A1',
          }}>
            Stage {stage} · {current.name}
          </div>
        </div>

        {/* ── Hero: animal + ring + dialogue ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 mt-1 mb-1">

          {/* Progress ring + interactive animal */}
          <div
            className="relative cursor-pointer"
            style={{width:148,height:148}}
            onClick={handleAnimalTap}
          >
            <svg viewBox="0 0 100 100" width={148} height={148} style={{transform:'rotate(-90deg)'}}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="5"/>
              <circle cx="50" cy="50" r={r} fill="none" stroke={ringColor} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={dash}
                style={{transition:'stroke-dashoffset .7s ease', filter:`drop-shadow(0 0 5px ${ringColor}99)`}}
              />
            </svg>
            {/* Percent label on ring */}
            <div className="absolute" style={{bottom:-4,left:'50%',transform:'translateX(-50%)'}}>
              <span className="text-white/80 text-[10px] font-bold drop-shadow">
                {next ? `${Math.round(progress*100)}%` : '100%'}
              </span>
            </div>
            {/* Animal emoji */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                fontSize:'3.75rem', lineHeight:1,
                animation: tapped ? 'tapPop .5s ease' : 'idleBounce 2.4s ease-in-out infinite',
                imageRendering: !isHD ? 'pixelated' : 'auto',
              }}
            >
              {current.emoji}
            </div>
          </div>

          {/* Spirit dialogue bubble */}
          <div
            key={spiritText}
            className="mx-6 px-4 py-2 rounded-2xl text-center text-sm font-medium max-w-xs"
            style={{
              background:'rgba(255,255,255,0.18)',
              backdropFilter:'blur(6px)',
              border:'1px solid rgba(255,255,255,0.3)',
              color:'rgba(255,255,255,0.95)',
              animation:'dialoguePop .3s ease',
            }}
          >
            {spiritText}
          </div>
        </div>

        {/* ── Evolution strip ── */}
        <div className="mb-3">
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
            Evolution Path
          </p>

          {/* Scrollable habitat row */}
          <div
            ref={stripRef}
            className="flex gap-2 overflow-x-auto px-4"
            style={{scrollbarWidth:'none', WebkitOverflowScrolling:'touch'}}
          >
            {STAGES.map((s, i) => {
              const unlocked = i < stage
              const isCurrent = i === stage
              const locked = i > stage

              return (
                <div
                  key={i}
                  data-stage={i}
                  onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  className="relative flex-shrink-0 cursor-pointer flex flex-col items-center rounded-2xl transition-transform active:scale-95"
                  style={{
                    width:72, paddingTop:8, paddingBottom:8,
                    background: isCurrent
                      ? (isHD ? 'rgba(245,158,11,.35)' : 'rgba(59,130,246,.35)')
                      : unlocked
                        ? 'rgba(255,255,255,.12)'
                        : 'rgba(0,0,0,.25)',
                    border: isCurrent
                      ? `2px solid ${isHD ? '#F59E0B' : '#60A5FA'}`
                      : '2px solid rgba(255,255,255,.08)',
                    animation: isCurrent ? 'shimmer 2.5s ease-in-out infinite' : undefined,
                    backdropFilter:'blur(6px)',
                  }}
                >
                  {/* Stage number */}
                  <span className="text-[9px] font-bold mb-1" style={{
                    color: isCurrent ? 'white' : unlocked ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)',
                  }}>
                    {i}
                  </span>

                  {/* Emoji / silhouette */}
                  <div style={{
                    fontSize:'1.75rem', lineHeight:1,
                    filter: locked ? 'grayscale(1) brightness(0.3)' : undefined,
                    opacity: locked ? 0.7 : 1,
                    imageRendering: s.tier === 'pixel' && !locked ? 'pixelated' : 'auto',
                  }}>
                    {s.emoji}
                  </div>

                  {/* Name */}
                  <span className="text-[8px] font-semibold mt-1 text-center leading-tight px-1" style={{
                    color: isCurrent ? 'white' : unlocked ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.2)',
                  }}>
                    {locked ? '???' : s.name}
                  </span>

                  {/* Badges */}
                  {unlocked && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                      <span style={{fontSize:9}}>✓</span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center" style={{fontSize:9}}>
                      ★
                    </div>
                  )}
                  {locked && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/40 flex items-center justify-center" style={{fontSize:9}}>
                      🔒
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Stage detail tooltip */}
          {selectedIdx !== null && (
            <div className="mx-4 mt-2 px-3 py-2 rounded-xl text-xs text-center font-medium"
              style={{background:'rgba(0,0,0,.4)',backdropFilter:'blur(8px)',color:'white',animation:'dialoguePop .2s ease'}}
            >
              {selectedIdx < stage && (
                <>✅ <strong>{STAGES[selectedIdx].name}</strong> — Evolved past at {fmtShort(THRESHOLDS[selectedIdx])}</>
              )}
              {selectedIdx === stage && (
                <>⭐ <strong>{STAGES[selectedIdx].name}</strong> — Current · {Math.round(progress*100)}% to next</>
              )}
              {selectedIdx > stage && (
                <>🔒 <strong>{STAGES[selectedIdx].name}</strong> — Need {fmtShort(THRESHOLDS[selectedIdx] - balance)} more</>
              )}
            </div>
          )}
        </div>

        {/* ── Finance cards ── */}
        <div className="px-4 pb-1" style={{maxWidth:420,margin:'0 auto',width:'100%'}}>
          <div className="grid grid-cols-3 gap-2">
            <FinanceCard label="Net Worth" value={fmtFull(balance)}        negative={balance < 0} isHD={isHD}/>
            <FinanceCard label="Income"    value={fmtFull(monthlyIncome)}  sub="this month"       isHD={isHD}/>
            <FinanceCard label="Spend"     value={fmtFull(monthlySpend)}   sub="this month"       isHD={isHD}/>
          </div>
        </div>
      </div>

      {/* ── Stage-up overlay ── */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{background:'rgba(0,0,0,.8)',backdropFilter:'blur(8px)'}}
          onClick={() => setShowOverlay(false)}
        >
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {CONFETTI.map((c,i) => (
              <div key={i} className="absolute w-2.5 h-2.5 rounded-sm" style={{
                left:`${c.left}%`, top:'-4%',
                backgroundColor:c.color,
                animation:`confettiFall ${c.duration}s ease-in ${c.delay}s both`,
                transform:`rotate(${c.rotation}deg)`,
              }}/>
            ))}
          </div>

          <div className="text-center px-6" style={{animation:'evolveIn .5s ease-out both'}}>
            <div style={{fontSize:'7rem',lineHeight:1,marginBottom:16}}>{evolvedInto.emoji}</div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'rgba(255,255,255,.55)'}}>
              Evolution!
            </p>
            <h2 className="text-3xl font-extrabold text-white mb-1">You&apos;re a {evolvedInto.name}!</h2>
            <p className="text-base" style={{color:'rgba(255,255,255,.65)'}}>Stage {stage} unlocked</p>
            <p className="text-sm mt-8" style={{color:'rgba(255,255,255,.35)'}}>Tap to continue</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CloudShape() {
  return (
    <svg width="92" height="48" viewBox="0 0 92 48">
      <ellipse cx="46" cy="38" rx="41" ry="12" fill="white" opacity="0.88"/>
      <ellipse cx="32" cy="28" rx="21" ry="17" fill="white" opacity="0.92"/>
      <ellipse cx="60" cy="26" rx="19" ry="16" fill="white" opacity="0.92"/>
    </svg>
  )
}

function TreeShape({ color }: { color: string }) {
  return (
    <svg width="46" height="74" viewBox="0 0 46 74">
      <polygon points="23,2 46,47 0,47" fill={color}/>
      <polygon points="23,18 44,58 2,58" fill={color} opacity="0.72"/>
      <rect x="19" y="58" width="8" height="14" fill="#92400E" rx="1"/>
    </svg>
  )
}

function FinanceCard({ label, value, sub, isHD, negative }: {
  label: string; value: string; sub?: string; isHD: boolean; negative?: boolean
}) {
  return (
    <div className="rounded-xl p-2.5 text-center border border-white/10" style={{
      background: isHD ? 'rgba(120,53,15,.55)' : 'rgba(3,105,161,.45)',
      backdropFilter:'blur(10px)',
    }}>
      <p className="font-semibold uppercase tracking-wide text-white/55" style={{fontSize:9}}>{label}</p>
      <p className="font-bold leading-tight mt-0.5" style={{fontSize:11,color:negative?'#FCA5A5':'white'}}>
        {negative?'-':''}{value}
      </p>
      {sub && <p className="text-white/35 mt-0.5" style={{fontSize:9}}>{sub}</p>}
    </div>
  )
}
