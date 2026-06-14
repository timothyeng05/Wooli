'use client'

import { useState, useEffect, useRef } from 'react'

// ── Stage definitions ─────────────────────────────────────────────────────────
const STAGES = [
  { name: 'Ant',          emoji: '🐜', min: 0,          tier: 'pixel', says: 'Every empire starts with one crumb. Keep saving! 🍂' },
  { name: 'Mouse',        emoji: '🐭', min: 1_000,      tier: 'pixel', says: 'Cheese is within reach. Keep it up! 🧀' },
  { name: 'Rabbit',       emoji: '🐰', min: 5_000,      tier: 'pixel', says: 'Hoppin\' along! Great habits forming. 🥕' },
  { name: 'Cat',          emoji: '🐱', min: 10_000,     tier: 'pixel', says: 'Five figures? Purrfect. Aim higher. 🐾' },
  { name: 'Dog',          emoji: '🐶', min: 25_000,     tier: 'pixel', says: 'Good job! $25K is no small feat. 🦴' },
  { name: 'Fox',          emoji: '🦊', min: 50_000,     tier: 'pixel', says: 'Sly and savvy — half a hundred grand! 🌿' },
  { name: 'Deer',         emoji: '🦌', min: 75_000,     tier: 'pixel', says: 'Graceful and growing. Six figures near. 🍃' },
  { name: 'Wolf',         emoji: '🐺', min: 100_000,    tier: 'hd',    says: 'Six figures! You\'ve joined the pack. 🌕' },
  { name: 'Bear',         emoji: '🐻', min: 250_000,    tier: 'hd',    says: 'Quarter million. Hibernate smart. 🍯' },
  { name: 'Horse',        emoji: '🐴', min: 500_000,    tier: 'hd',    says: 'Half a million — galloping to glory! 🌾' },
  { name: 'Lion',         emoji: '🦁', min: 1_000_000,  tier: 'hd',    says: 'Millionaire. The pride is yours. 🌅' },
  { name: 'Tiger',        emoji: '🐯', min: 2_500_000,  tier: 'hd',    says: 'Fierce and unstoppable. 🔥' },
  { name: 'Elephant',     emoji: '🐘', min: 5_000_000,  tier: 'hd',    says: 'Never stops. Five million and counting. 🌍' },
  { name: 'Elder Dragon', emoji: '🐉', min: 10_000_000, tier: 'hd',    says: 'Legendary. You have transcended finance. 🌟' },
] as const

type Stage = (typeof STAGES)[number]
const THRESHOLDS = STAGES.map(s => s.min)
const STORAGE_KEY = 'wooli_zoo_stage'

// Pre-computed scene positions for each of the 14 stages
// left: % from left edge, yLevel: 0=front 1=mid 2=back
// dir: +1 = starts moving right, -1 = starts moving left
// dist: vw units to travel, dur: animation seconds, delay: start offset
const SCENE_POS = [
  { left: 6,  yLevel: 0, dir:  1, dist: 14, dur:  9.0, delay: 0.0 },
  { left: 28, yLevel: 1, dir: -1, dist: 11, dur: 11.5, delay: 1.5 },
  { left: 54, yLevel: 2, dir:  1, dist:  9, dur:  8.0, delay: 3.0 },
  { left: 74, yLevel: 0, dir: -1, dist: 12, dur: 10.0, delay: 0.8 },
  { left: 16, yLevel: 2, dir:  1, dist: 12, dur: 13.0, delay: 2.0 },
  { left: 40, yLevel: 0, dir: -1, dist: 11, dur:  9.5, delay: 4.0 },
  { left: 64, yLevel: 1, dir:  1, dist: 10, dur: 12.0, delay: 1.0 },
  { left: 22, yLevel: 1, dir: -1, dist: 12, dur:  8.5, delay: 2.5 },
  { left: 56, yLevel: 0, dir:  1, dist: 11, dur: 14.0, delay: 0.3 },
  { left: 80, yLevel: 2, dir: -1, dist:  8, dur: 10.5, delay: 3.5 },
  { left: 34, yLevel: 0, dir:  1, dist: 13, dur: 11.0, delay: 1.8 },
  { left: 68, yLevel: 1, dir: -1, dist:  9, dur:  9.0, delay: 0.5 },
  { left: 12, yLevel: 2, dir:  1, dist: 10, dur: 12.5, delay: 2.8 },
  { left: 46, yLevel: 1, dir: -1, dist: 11, dur: 10.0, delay: 1.2 },
]

// Y position within the scene (% from scene bottom): front → back = lower → higher
const Y_PCT   = [30, 36, 42]           // bottom % within scene by yLevel
const SIZES   = ['1.9rem', '1.5rem', '1.15rem']  // emoji size by yLevel (perspective)
const HERO_SIZE = '3.4rem'

const CONFETTI_COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#FF8C94']
const CONFETTI = Array.from({ length: 50 }, (_, i) => ({
  left: (i * 37 + 13) % 100, delay: (i * 0.07) % 1.5,
  duration: 1.5 + (i * 0.04) % 1.2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
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
  return Math.min((balance - THRESHOLDS[stage]) / (THRESHOLDS[stage + 1] - THRESHOLDS[stage]), 1.0)
}

function fmtFull(n: number) {
  return Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtShort(n: number) {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 1_000)     return `$${Math.round(a / 1_000)}K`
  return `$${Math.round(a).toLocaleString()}`
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { balance: number; monthlyIncome: number; monthlySpend: number }

export default function ZooPageClient({ balance, monthlyIncome, monthlySpend }: Props) {
  const stage    = getStage(balance)
  const progress = progressToNext(balance, stage)
  const current  = STAGES[stage]
  const next     = STAGES[stage + 1] as Stage | undefined
  const isHD     = current.tier === 'hd'

  const [showOverlay, setShowOverlay] = useState(false)
  const [evolvedInto, setEvolvedInto] = useState<Stage>(current)
  const [tapped, setTapped]           = useState(false)
  const [tapCount, setTapCount]       = useState(0)
  const [selectedLocked, setSelected] = useState<number | null>(null)
  const lockedRef = useRef<HTMLDivElement>(null)

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

  const handleHeroTap = () => {
    setTapped(true)
    setTapCount(c => c + 1)
    if ('vibrate' in navigator) navigator.vibrate(40)
    setTimeout(() => setTapped(false), 550)
  }

  // Generate per-animal CSS keyframes
  const animalCSS = Array.from({ length: stage + 1 }, (_, i) => {
    const p = SCENE_POS[i]
    const startFace = p.dir > 0 ? 1 : -1
    return `
      @keyframes roam${i} {
        0%, 100% { transform: translateX(0); }
        45%, 55% { transform: translateX(${p.dist * p.dir}vw); }
      }
      @keyframes face${i} {
        0%,  43% { transform: scaleX(${startFace}); }
        44%, 56% { transform: scaleX(${startFace}) translateY(-4px); }
        57%,100% { transform: scaleX(${-startFace}); }
      }
    `
  }).join('\n')

  // Theme
  const skyTop    = isHD ? '#F59E0B' : '#0EA5E9'
  const skyBottom = isHD ? '#FDE68A' : '#BAE6FD'
  const groundTop = isHD ? '#CA8A04' : '#16A34A'
  const groundBot = isHD ? '#92400E' : '#15803D'
  const ringColor = isHD ? '#F59E0B' : '#3B82F6'
  const treeColor = isHD ? '#92400E' : '#15803D'
  const fenceClr  = isHD ? '#78350F' : '#92400E'

  const spiritText = tapCount > 5
    ? `Stop poking me! 😤 Save ${fmtShort(next ? THRESHOLDS[stage + 1] - balance : 0)} and I'll evolve!`
    : next
      ? progress > 0.8
        ? `Almost there! Just ${fmtShort(THRESHOLDS[stage + 1] - balance)} more! 🔥`
        : current.says
      : '🌟 Legendary — the ultimate form!'

  const lockedStages = STAGES.slice(stage + 1)

  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight: '100dvh', background: `linear-gradient(to bottom, ${skyTop}, ${skyBottom})` }}
    >
      {/* Static + per-animal keyframes */}
      <style>{`
        @keyframes cloudDrift  { 0%,100%{transform:translateX(0)} 50%{transform:translateX(16px)} }
        @keyframes tapPop      { 0%{transform:scale(1)} 30%{transform:scale(1.3) rotate(-10deg)} 60%{transform:scale(.9) rotate(6deg)} 100%{transform:scale(1)} }
        @keyframes confettiFall{ 0%{opacity:1;transform:translateY(-20px) rotate(0)} 100%{opacity:0;transform:translateY(110vh) rotate(720deg)} }
        @keyframes evolveIn    { 0%{opacity:0;transform:scale(.3) translateY(20px)} 60%{transform:scale(1.1) translateY(-4px)} 100%{opacity:1;transform:scale(1)} }
        @keyframes dialoguePop { 0%{opacity:0;transform:scale(.85) translateY(6px)} 100%{opacity:1;transform:scale(1)} }
        @keyframes heroGlow    { 0%,100%{filter:drop-shadow(0 0 6px rgba(255,255,255,.5))} 50%{filter:drop-shadow(0 0 14px rgba(255,255,255,.9))} }
        ${animalCSS}
      `}</style>

      {/* ── Scene (top ~57% of screen) ──────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-0" style={{ height: '57%' }}>

        {/* Sun */}
        <div className="absolute rounded-full pointer-events-none" style={{
          width: 68, height: 68, top: 24, right: 24,
          background: isHD ? 'radial-gradient(circle at 40% 40%,#FEF3C7,#F59E0B)' : 'radial-gradient(circle at 40% 40%,#FFFDE7,#FCD34D)',
          boxShadow: `0 0 ${isHD?44:28}px ${isHD?'rgba(251,191,36,.6)':'rgba(252,211,77,.5)'}`,
        }}/>

        {/* Clouds */}
        <div className="absolute pointer-events-none" style={{ top:46, left:'8%', animation:'cloudDrift 9s ease-in-out infinite' }}>
          <CloudShape/>
        </div>
        <div className="absolute pointer-events-none" style={{ top:84, left:'52%', transform:'scale(.6)', animation:'cloudDrift 13s ease-in-out 3s infinite' }}>
          <CloudShape/>
        </div>

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
          height: '36%',
          background: `linear-gradient(to bottom, ${groundTop}, ${groundBot})`,
          borderRadius: '40% 40% 0 0 / 8% 8% 0 0',
        }}/>

        {/* Trees */}
        <div className="absolute pointer-events-none" style={{ bottom:'33%', left:6 }}>
          <TreeShape color={treeColor}/>
        </div>
        <div className="absolute pointer-events-none" style={{ bottom:'33%', right:10, transform:'scale(.72)' }}>
          <TreeShape color={treeColor}/>
        </div>

        {/* Fence */}
        <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'31%' }}>
          <svg viewBox="0 0 400 42" width="100%" height="42" preserveAspectRatio="none">
            <rect x="0" y="8"  width="400" height="5" fill={fenceClr} rx="1"/>
            <rect x="0" y="22" width="400" height="5" fill={fenceClr} rx="1"/>
            {[0,1,2,3,4,5,6,7,8,9].map(i=>(
              <rect key={i} x={i*44+10} y="2" width="10" height="36" fill={fenceClr} rx="2"/>
            ))}
          </svg>
        </div>

        {/* Stage badge */}
        <div className="absolute left-0 right-0 flex justify-center" style={{ top: 12 }}>
          <div className="px-4 py-1 rounded-full text-xs font-bold border" style={{
            backdropFilter:'blur(8px)',
            background: isHD ? 'rgba(254,243,199,.88)' : 'rgba(224,242,254,.88)',
            borderColor: isHD ? '#F59E0B' : '#38BDF8',
            color:       isHD ? '#92400E' : '#0369A1',
          }}>
            Stage {stage} · {current.name}
          </div>
        </div>

        {/* ── All unlocked animals wandering ── */}
        {Array.from({ length: stage + 1 }, (_, i) => {
          const pos       = SCENE_POS[i]
          const isCurrent = i === stage
          const size      = isCurrent ? HERO_SIZE : SIZES[pos.yLevel]
          const bottom    = Y_PCT[pos.yLevel]
          const s         = STAGES[i]

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${pos.left}%`,
                bottom: `${bottom}%`,
                animation: `roam${i} ${pos.dur}s ${pos.delay}s ease-in-out infinite`,
                zIndex: isCurrent ? 5 : pos.yLevel === 0 ? 4 : pos.yLevel === 1 ? 3 : 2,
              }}
              onClick={isCurrent ? handleHeroTap : undefined}
            >
              <div
                style={{
                  fontSize: size,
                  lineHeight: 1,
                  cursor: isCurrent ? 'pointer' : 'default',
                  imageRendering: s.tier === 'pixel' ? 'pixelated' : 'auto',
                  animation: isCurrent
                    ? tapped
                      ? 'tapPop .55s ease'
                      : `face${i} ${pos.dur}s ${pos.delay}s ease-in-out infinite, heroGlow 2.5s ease-in-out infinite`
                    : `face${i} ${pos.dur}s ${pos.delay}s ease-in-out infinite`,
                }}
              >
                {s.emoji}
              </div>

              {/* Current hero star */}
              {isCurrent && (
                <div style={{ textAlign:'center', fontSize:9, color:'white', fontWeight:'bold', textShadow:'0 1px 3px rgba(0,0,0,.7)', marginTop:1 }}>
                  ★ you
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Info panel (bottom ~43%) ─────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 bottom-0 flex flex-col" style={{
        height: '43%',
        background: isHD ? 'rgba(120,53,15,.82)' : 'rgba(3,105,161,.75)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,.15)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}>

        {/* Progress bar toward next stage */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white text-xs font-semibold">{current.emoji} {current.name}</span>
            {next
              ? <span className="text-white/60 text-xs">{fmtShort(THRESHOLDS[stage + 1] - balance)} to {next.name} {next.emoji}</span>
              : <span className="text-white/60 text-xs">Max evolution 🌟</span>
            }
          </div>
          <div className="rounded-full overflow-hidden" style={{ height:6, background:'rgba(255,255,255,.15)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{
              width: `${Math.round(progress * 100)}%`,
              background: isHD
                ? 'linear-gradient(to right, #FCD34D, #F59E0B)'
                : 'linear-gradient(to right, #60A5FA, #3B82F6)',
              boxShadow: `0 0 6px ${ringColor}88`,
            }}/>
          </div>
        </div>

        {/* Spirit dialogue */}
        <div
          key={spiritText}
          className="mx-4 px-3 py-1.5 rounded-xl text-center text-xs font-medium mb-2"
          style={{ background:'rgba(255,255,255,.1)', color:'rgba(255,255,255,.92)', animation:'dialoguePop .3s ease' }}
          onClick={handleHeroTap}
        >
          {spiritText}
        </div>

        {/* Locked stages strip */}
        {lockedStages.length > 0 && (
          <div className="mb-2">
            <p className="px-4 text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              Locked ({lockedStages.length} remaining)
            </p>
            <div
              ref={lockedRef}
              className="flex gap-2 overflow-x-auto px-4"
              style={{ scrollbarWidth:'none' }}
            >
              {lockedStages.map((s, idx) => {
                const absIdx  = stage + 1 + idx
                const isSel   = selectedLocked === absIdx
                const needed  = THRESHOLDS[absIdx] - balance

                return (
                  <div
                    key={absIdx}
                    onClick={() => setSelected(isSel ? null : absIdx)}
                    className="flex-shrink-0 flex flex-col items-center rounded-xl cursor-pointer transition-all active:scale-95"
                    style={{
                      width: 60, paddingTop:6, paddingBottom:6,
                      background: isSel ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.25)',
                      border: isSel ? '1.5px solid rgba(255,255,255,.5)' : '1.5px solid rgba(255,255,255,.06)',
                    }}
                  >
                    <span className="text-[8px] font-bold text-white/30">{absIdx}</span>
                    <div style={{ fontSize:'1.6rem', filter:'grayscale(1) brightness(.35)', lineHeight:1 }}>{s.emoji}</div>
                    <span className="text-[8px] font-semibold text-white/25 mt-0.5">???</span>
                    {isSel && (
                      <span className="text-[7px] text-white/60 mt-0.5 text-center px-1 leading-tight">
                        {fmtShort(needed)} needed
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Finance cards */}
        <div className="px-4 mt-auto" style={{ maxWidth:420, margin:'auto', width:'100%' }}>
          <div className="grid grid-cols-3 gap-2">
            <FinCard label="Net Worth" value={fmtFull(balance)}       neg={balance < 0}/>
            <FinCard label="Income"    value={fmtFull(monthlyIncome)} sub="this month"/>
            <FinCard label="Spend"     value={fmtFull(monthlySpend)}  sub="this month"/>
          </div>
        </div>
      </div>

      {/* ── Stage-up overlay ─────────────────────────────────────────────────── */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background:'rgba(0,0,0,.82)', backdropFilter:'blur(10px)' }}
          onClick={() => setShowOverlay(false)}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {CONFETTI.map((c,i) => (
              <div key={i} className="absolute w-2.5 h-2.5 rounded-sm" style={{
                left:`${c.left}%`, top:'-4%', backgroundColor:c.color,
                animation:`confettiFall ${c.duration}s ease-in ${c.delay}s both`,
                transform:`rotate(${c.rotation}deg)`,
              }}/>
            ))}
          </div>
          <div className="text-center px-6" style={{ animation:'evolveIn .5s ease-out both' }}>
            <div style={{ fontSize:'7rem', lineHeight:1, marginBottom:16 }}>{evolvedInto.emoji}</div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:'rgba(255,255,255,.5)' }}>Evolution!</p>
            <h2 className="text-3xl font-extrabold text-white mb-1">You&apos;re a {evolvedInto.name}!</h2>
            <p style={{ color:'rgba(255,255,255,.6)' }}>Stage {stage} unlocked</p>
            <p className="text-sm mt-8" style={{ color:'rgba(255,255,255,.3)' }}>Tap to continue</p>
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
      <ellipse cx="46" cy="38" rx="41" ry="12" fill="white" opacity=".88"/>
      <ellipse cx="32" cy="28" rx="21" ry="17" fill="white" opacity=".92"/>
      <ellipse cx="60" cy="26" rx="19" ry="16" fill="white" opacity=".92"/>
    </svg>
  )
}

function TreeShape({ color }: { color: string }) {
  return (
    <svg width="46" height="74" viewBox="0 0 46 74">
      <polygon points="23,2 46,47 0,47" fill={color}/>
      <polygon points="23,18 44,58 2,58" fill={color} opacity=".72"/>
      <rect x="19" y="58" width="8" height="14" fill="#92400E" rx="1"/>
    </svg>
  )
}

function FinCard({ label, value, sub, neg }: { label:string; value:string; sub?:string; neg?:boolean }) {
  return (
    <div className="rounded-xl p-2.5 text-center border border-white/10" style={{ background:'rgba(0,0,0,.22)' }}>
      <p className="font-semibold uppercase tracking-wide text-white/50" style={{ fontSize:9 }}>{label}</p>
      <p className="font-bold leading-tight mt-0.5" style={{ fontSize:11, color:neg?'#FCA5A5':'white' }}>
        {neg?'-':''}{value}
      </p>
      {sub && <p className="text-white/35 mt-0.5" style={{ fontSize:9 }}>{sub}</p>}
    </div>
  )
}
