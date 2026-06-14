'use client'

import { useState, useEffect } from 'react'
import { SPRITES } from './ZooSprites'

// ── Stage & habitat definitions ───────────────────────────────────────────────
const STAGES = [
  { name: 'Plankton',   habitat: 0, min: 0,           says: 'Every ocean starts with a single drop. You\'re just beginning! 🌊' },
  { name: 'Shrimp',     habitat: 0, min: 500,          says: 'Look at you, scuttling forward! $500 saved and counting.' },
  { name: 'Clownfish',  habitat: 0, min: 2_000,        says: 'Finding your way through the reef! $2K — keep swimming.' },
  { name: 'Pufferfish', habitat: 0, min: 6_000,        says: 'Puffed up with potential. $10K is just around the current!' },
  { name: 'Tree Frog',  habitat: 1, min: 10_000,       says: 'You\'ve leapt into the jungle! $10K and climbing higher.' },
  { name: 'Toucan',     habitat: 1, min: 20_000,       says: 'Colorful savings, colorful future. $20K looks good on you!' },
  { name: 'Monkey',     habitat: 1, min: 40_000,       says: 'Swinging through the canopy! $40K — you\'re unstoppable.' },
  { name: 'Tiger',      habitat: 1, min: 70_000,       says: 'Fierce and focused. The savanna is calling your name.' },
  { name: 'Zebra',      habitat: 2, min: 100_000,      says: 'Six figures! Standing out from the herd in style.' },
  { name: 'Giraffe',    habitat: 2, min: 300_000,      says: 'Head above the clouds, sights set even higher. $300K!' },
  { name: 'Lion',       habitat: 2, min: 600_000,      says: 'Ruler of the savanna. One more leap into the mythical realm.' },
  { name: 'Griffin',    habitat: 3, min: 1_000_000,    says: 'Half legend, half power. You\'ve crossed ONE MILLION. 🌟' },
  { name: 'Phoenix',    habitat: 3, min: 10_000_000,   says: 'Rising in eternal flame. $10M — you are the fire itself.' },
  { name: 'Dragon',     habitat: 3, min: 50_000_000,   says: 'Ancient. Mighty. Limitless. The mythical realm is yours. 🐉' },
] as const

type Stage = (typeof STAGES)[number]

const THRESHOLDS = STAGES.map(s => s.min)
const STAGE_KEY  = 'wooli_zoo_stage'
const GOAL_KEY   = 'wooli_zoo_goal'
const GOAL_DATE  = 'wooli_zoo_goal_date'

// ── Habitat definitions ───────────────────────────────────────────────────────
const HABITATS = [
  {
    id: 'ocean',
    name: 'Deep Ocean',
    skyFrom: '#001833', skyTo: '#005f8a',
    groundFrom: '#b8860b', groundTo: '#6b4c11',
    groundRadius: '50% 50% 0 0 / 6% 6% 0 0',
    badgeBg: 'rgba(0,24,51,.9)', badgeBorder: '#38bdf8', badgeText: '#7dd3fc',
    panelBg: 'rgba(0,18,40,.84)',
  },
  {
    id: 'jungle',
    name: 'Rainforest',
    skyFrom: '#0d3b1a', skyTo: '#1a6b2d',
    groundFrom: '#4a3018', groundTo: '#2d1c0d',
    groundRadius: '45% 45% 0 0 / 6% 6% 0 0',
    badgeBg: 'rgba(13,59,26,.9)', badgeBorder: '#4ade80', badgeText: '#86efac',
    panelBg: 'rgba(10,46,20,.84)',
  },
  {
    id: 'savanna',
    name: 'African Savanna',
    skyFrom: '#7c2d00', skyTo: '#ea580c',
    groundFrom: '#ca8a04', groundTo: '#92400e',
    groundRadius: '40% 40% 0 0 / 5% 5% 0 0',
    badgeBg: 'rgba(120,45,0,.9)', badgeBorder: '#f59e0b', badgeText: '#fcd34d',
    panelBg: 'rgba(100,35,0,.84)',
  },
  {
    id: 'mythical',
    name: 'Mythical Realm',
    skyFrom: '#0c0a1d', skyTo: '#2d1b69',
    groundFrom: '#2e1065', groundTo: '#0c0a1d',
    groundRadius: '30% 30% 0 0 / 4% 4% 0 0',
    badgeBg: 'rgba(12,10,29,.9)', badgeBorder: '#a78bfa', badgeText: '#c4b5fd',
    panelBg: 'rgba(8,6,22,.88)',
  },
] as const

// Positions for up to 14 animals in the scene
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

// Y% from scene bottom, and px sizes, by yLevel (front → back perspective)
const Y_PCT  = [29, 35, 41]
const SIZES  = [40, 32, 24]   // px
const HERO_SIZE = 58           // px

const DAILY_GOALS = [
  { emoji: '💰', text: 'Review my spending' },
  { emoji: '📈', text: 'Check my net worth' },
  { emoji: '🎯', text: 'Stay under budget today' },
  { emoji: '💎', text: 'Save more than I spend' },
]

const CONFETTI_COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#FF8C94']
const CONFETTI = Array.from({ length: 50 }, (_, i) => ({
  left: (i * 37 + 13) % 100, delay: (i * 0.07) % 1.5,
  duration: 1.5 + (i * 0.04) % 1.2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotation: (i * 47) % 360,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStage(balance: number) {
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (balance >= THRESHOLDS[i]) return i
  }
  return 0
}

function progress(balance: number, stage: number) {
  if (stage >= THRESHOLDS.length - 1) return 1
  return Math.min((balance - THRESHOLDS[stage]) / (THRESHOLDS[stage + 1] - THRESHOLDS[stage]), 1)
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

function today() { return new Date().toISOString().split('T')[0] }

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { balance: number; monthlyIncome: number; monthlySpend: number }

export default function ZooPageClient({ balance, monthlyIncome, monthlySpend }: Props) {
  const stage   = getStage(balance)
  const prog    = progress(balance, stage)
  const current = STAGES[stage]
  const next    = STAGES[stage + 1] as Stage | undefined
  const hab     = HABITATS[current.habitat]
  const Sprite  = SPRITES[stage]

  const [showGoal,    setShowGoal]    = useState(false)
  const [goalStep,    setGoalStep]    = useState<'intro'|'pick'>('intro')
  const [goalChoice,  setGoalChoice]  = useState('')
  const [customGoal,  setCustomGoal]  = useState('')
  const [savedGoal,   setSavedGoal]   = useState('')
  const [showOverlay, setShowOverlay] = useState(false)
  const [evolvedInto, setEvolvedInto] = useState<Stage>(current)
  const [tapped,      setTapped]      = useState(false)
  const [tapCount,    setTapCount]    = useState(0)
  const [selectedLocked, setSelected] = useState<number|null>(null)

  useEffect(() => {
    try {
      // Daily goal check
      const goalDate = localStorage.getItem(GOAL_DATE)
      const goal     = localStorage.getItem(GOAL_KEY) ?? ''
      setSavedGoal(goal)
      if (goalDate !== today()) setShowGoal(true)

      // Stage-up detection
      const saved = parseInt(localStorage.getItem(STAGE_KEY) ?? '-1', 10)
      if (stage > saved && saved >= 0) {
        setEvolvedInto(STAGES[stage])
        setShowOverlay(true)
        if ('vibrate' in navigator) navigator.vibrate(200)
      }
      localStorage.setItem(STAGE_KEY, String(stage))
    } catch { /* private mode */ }
  }, [stage])

  const commitGoal = () => {
    const g = goalChoice || customGoal || 'Keep saving!'
    try {
      localStorage.setItem(GOAL_KEY, g)
      localStorage.setItem(GOAL_DATE, today())
    } catch { /* */ }
    setSavedGoal(g)
    setShowGoal(false)
    setGoalChoice('')
    setCustomGoal('')
    setGoalStep('intro')
  }

  const handleHeroTap = () => {
    setTapped(true)
    setTapCount(c => c + 1)
    if ('vibrate' in navigator) navigator.vibrate(40)
    setTimeout(() => setTapped(false), 550)
  }

  // Generate per-animal roam CSS
  const animalCSS = Array.from({ length: stage + 1 }, (_, i) => {
    const p = SCENE_POS[i]
    const sf = p.dir > 0 ? 1 : -1
    return `
      @keyframes roam${i} {
        0%,100% { transform: translateX(0); }
        45%,55% { transform: translateX(${p.dist * p.dir}vw); }
      }
      @keyframes face${i} {
        0%,43%  { transform: scaleX(${sf}); }
        44%,56% { transform: scaleX(${sf}) translateY(-5px); }
        57%,100%{ transform: scaleX(${-sf}); }
      }
    `
  }).join('\n')

  const spiritText = tapCount > 5
    ? `Hehe — stop poking me! 😤`
    : next
      ? prog > 0.8
        ? `So close! ${fmtShort(THRESHOLDS[stage + 1] - balance)} to ${next.name}! 🔥`
        : current.says
      : '🌟 Legendary status — the storm is yours!'

  const lockedStages = STAGES.slice(stage + 1)

  // Habitat-specific scene decorations
  const isOcean    = current.habitat === 0
  const isJungle   = current.habitat === 1
  const isSavanna  = current.habitat === 2
  const isMythical = current.habitat === 3

  return (
    <div className="relative overflow-hidden" style={{ minHeight:'100dvh', background:`linear-gradient(to bottom, ${hab.skyFrom}, ${hab.skyTo})` }}>

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes cloudDrift   { 0%,100%{transform:translateX(0)} 50%{transform:translateX(16px)} }
        @keyframes tapPop       { 0%{transform:scale(1)} 30%{transform:scale(1.3) rotate(-8deg)} 60%{transform:scale(.92) rotate(5deg)} 100%{transform:scale(1)} }
        @keyframes confettiFall { 0%{opacity:1;transform:translateY(-20px) rotate(0)} 100%{opacity:0;transform:translateY(110vh) rotate(720deg)} }
        @keyframes evolveIn     { 0%{opacity:0;transform:scale(.3) translateY(20px)} 60%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1)} }
        @keyframes dialoguePop  { 0%{opacity:0;transform:scale(.85) translateY(6px)} 100%{opacity:1;transform:scale(1)} }
        @keyframes heroGlow     { 0%,100%{filter:drop-shadow(0 0 5px rgba(255,255,255,.4))} 50%{filter:drop-shadow(0 0 14px rgba(255,255,255,.85))} }
        @keyframes snowfall     { 0%{transform:translateY(-10px) rotate(0)} 100%{transform:translateY(60vh) rotate(360deg)} }
        @keyframes lightning    { 0%,90%,100%{opacity:0} 92%,96%{opacity:1} }
        @keyframes bubble       { 0%{transform:translateY(0) scale(1);opacity:.6} 100%{transform:translateY(-60px) scale(1.3);opacity:0} }
        @keyframes introSlide   { 0%{opacity:0;transform:translateX(60px)} 100%{opacity:1;transform:translateX(0)} }
        @keyframes goalPop      { 0%{opacity:0;transform:scale(.8)} 100%{opacity:1;transform:scale(1)} }
        ${animalCSS}
      `}</style>

      {/* ── Scene area (top 57%) ──────────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-0" style={{ height:'57%' }}>

        {/* Celestial body — sun for savanna/jungle, deep moon for ocean, cosmic orb for mythical */}
        {!isOcean && (
          <div className="absolute rounded-full pointer-events-none" style={{
            width: isMythical ? 52 : isSavanna ? 72 : 60,
            height: isMythical ? 52 : isSavanna ? 72 : 60,
            top: 18, right: 22,
            background: isMythical
              ? 'radial-gradient(circle at 40% 40%,#c4b5fd,#7c3aed)'
              : isSavanna
                ? 'radial-gradient(circle at 40% 40%,#fed7aa,#f97316)'
                : 'radial-gradient(circle at 40% 40%,#FFFDE7,#FCD34D)',
            boxShadow: isMythical
              ? '0 0 32px rgba(139,92,246,.6)'
              : isSavanna
                ? '0 0 48px rgba(249,115,22,.5)'
                : '0 0 28px rgba(252,211,77,.5)',
          }}/>
        )}

        {/* Ocean: caustic light rays + bubbles */}
        {isOcean && (
          <>
            <div className="absolute inset-0 pointer-events-none" style={{ opacity:.14 }}>
              {[12,28,46,62,78].map((x,i) => (
                <div key={i} style={{
                  position:'absolute', top:0, left:`${x}%`, width:22, height:'100%',
                  background:'linear-gradient(to bottom,#38bdf8,transparent)',
                  transform:`rotate(${(i-2)*6}deg)`, transformOrigin:'top center',
                }}/>
              ))}
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({length:14},(_,i)=>(
                <div key={i} style={{
                  position:'absolute',
                  left:`${(i*19+5)%90}%`, bottom:`${(i*11)%40}%`,
                  width:5+i%7, height:5+i%7, borderRadius:'50%',
                  border:'1.5px solid rgba(56,189,248,.4)',
                  animation:`bubble ${2+i%3}s ${i*.4}s ease-out infinite`,
                }}/>
              ))}
            </div>
          </>
        )}

        {/* Jungle: canopy glow + fireflies */}
        {isJungle && (
          <>
            <div className="absolute pointer-events-none" style={{ top:50, left:'6%', animation:'cloudDrift 11s ease-in-out infinite' }}>
              <CloudShape color="rgba(34,197,94,.35)"/>
            </div>
            <div className="absolute pointer-events-none" style={{ top:90, left:'55%', transform:'scale(.65)', animation:'cloudDrift 16s ease-in-out 4s infinite' }}>
              <CloudShape color="rgba(34,197,94,.3)"/>
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({length:12},(_,i)=>(
                <div key={i} style={{
                  position:'absolute',
                  left:`${(i*23+8)%92}%`, top:`${(i*17+10)%60}%`,
                  width:4, height:4, borderRadius:'50%',
                  background:'#fef08a', opacity: .7,
                  animation:`heroGlow ${1.5+i%2}s ${i*.4}s ease-in-out infinite`,
                }}/>
              ))}
            </div>
          </>
        )}

        {/* Savanna: dust + haze */}
        {isSavanna && (
          <>
            <div className="absolute pointer-events-none" style={{ top:40, left:'5%', animation:'cloudDrift 12s ease-in-out infinite' }}>
              <CloudShape color="rgba(251,191,36,.25)"/>
            </div>
            <div className="absolute pointer-events-none" style={{ top:70, left:'60%', transform:'scale(.7)', animation:'cloudDrift 18s ease-in-out 5s infinite' }}>
              <CloudShape color="rgba(234,88,12,.2)"/>
            </div>
          </>
        )}

        {/* Mythical: stars + aurora */}
        {isMythical && (
          <>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({length:24},(_,i)=>(
                <div key={i} style={{
                  position:'absolute',
                  left:`${(i*19+3)%98}%`, top:`${(i*13+2)%55}%`,
                  width: i%4===0?4:i%3===0?3:2, height: i%4===0?4:i%3===0?3:2,
                  borderRadius:'50%', background:'white', opacity:.8,
                  animation:`heroGlow ${2+i%3}s ${i*.25}s ease-in-out infinite`,
                }}/>
              ))}
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ opacity:.08 }}>
              {[0,1,2].map(i=>(
                <div key={i} style={{
                  position:'absolute', top:`${10+i*12}%`, left:0, right:0, height:18,
                  background:`linear-gradient(to right, transparent, ${['#a78bfa','#67e8f9','#f9a8d4'][i]}, transparent)`,
                  animation:`cloudDrift ${8+i*3}s ${i*2}s ease-in-out infinite`,
                }}/>
              ))}
            </div>
          </>
        )}

        {/* Ocean: coral/seaweed on floor */}
        {isOcean && (
          <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'29%' }}>
            <svg viewBox="0 0 400 30" width="100%" height="30" preserveAspectRatio="none">
              {[10,60,110,160,220,280,330,370].map((x,i)=>(
                <ellipse key={i} cx={x} cy={10} rx={8+i%5} ry={10+i%8} fill={i%2===0?'#0e7490':'#155e75'} opacity=".8"/>
              ))}
            </svg>
          </div>
        )}

        {/* Jungle: trees + vines */}
        {isJungle && (
          <>
            <div className="absolute pointer-events-none" style={{ bottom:'33%', left:4 }}>
              <JungleTree/>
            </div>
            <div className="absolute pointer-events-none" style={{ bottom:'33%', right:6, transform:'scale(.8) scaleX(-1)' }}>
              <JungleTree/>
            </div>
            <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'31%' }}>
              <TallGrass color="#15803d"/>
            </div>
          </>
        )}

        {/* Savanna: acacia trees + tall grass */}
        {isSavanna && (
          <>
            <div className="absolute pointer-events-none" style={{ bottom:'33%', left:4 }}>
              <AcaciaTree/>
            </div>
            <div className="absolute pointer-events-none" style={{ bottom:'33%', right:6, transform:'scale(.78) scaleX(-1)' }}>
              <AcaciaTree/>
            </div>
            <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'31%' }}>
              <TallGrass color="#ca8a04"/>
            </div>
          </>
        )}

        {/* Mythical: jagged crystal spires */}
        {isMythical && (
          <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'29%' }}>
            <svg viewBox="0 0 400 28" width="100%" height="28" preserveAspectRatio="none">
              <path d="M0 28 L30 6 L50 20 L80 2 L110 18 L140 8 L170 24 L200 4 L230 20 L260 10 L290 22 L320 6 L350 18 L380 8 L400 28Z" fill="#4c1d95" opacity=".9"/>
              <path d="M0 28 L35 10 L55 22 L85 6 L115 20 L145 12 L175 26 L205 8 L235 22 L265 14 L295 24 L325 10 L355 20 L385 10 L400 28Z" fill="#5b21b6" opacity=".7"/>
            </svg>
          </div>
        )}

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
          height:'36%',
          background:`linear-gradient(to bottom, ${hab.groundFrom}, ${hab.groundTo})`,
          borderRadius: hab.groundRadius,
        }}/>

        {/* Stage badge */}
        <div className="absolute left-0 right-0 flex justify-center" style={{ top:12 }}>
          <div className="px-4 py-1 rounded-full text-xs font-bold border" style={{
            backdropFilter:'blur(8px)',
            background: hab.badgeBg,
            borderColor: hab.badgeBorder,
            color: hab.badgeText,
          }}>
            {hab.name} · Stage {stage} · {current.name}
          </div>
        </div>

        {/* ── All unlocked animals wandering ── */}
        {Array.from({ length: stage + 1 }, (_, i) => {
          const pos       = SCENE_POS[i]
          const isCurrent = i === stage
          const sz        = isCurrent ? HERO_SIZE : SIZES[pos.yLevel]
          const bottom    = Y_PCT[pos.yLevel]
          const Sp        = SPRITES[i]

          return (
            <div key={i} style={{
              position:'absolute', left:`${pos.left}%`, bottom:`${bottom}%`,
              animation:`roam${i} ${pos.dur}s ${pos.delay}s ease-in-out infinite`,
              zIndex: isCurrent ? 5 : 3 - pos.yLevel,
            }}>
              <div
                onClick={isCurrent ? handleHeroTap : undefined}
                style={{
                  cursor: isCurrent ? 'pointer' : 'default',
                  animation: isCurrent
                    ? tapped
                      ? 'tapPop .55s ease'
                      : `face${i} ${pos.dur}s ${pos.delay}s ease-in-out infinite, heroGlow 2.5s ease-in-out infinite`
                    : `face${i} ${pos.dur}s ${pos.delay}s ease-in-out infinite`,
                }}
              >
                <Sp size={sz}/>
              </div>
              {isCurrent && (
                <div style={{ textAlign:'center', fontSize:9, color:'white', fontWeight:'bold', textShadow:'0 1px 3px rgba(0,0,0,.8)', marginTop:2 }}>
                  ★ you
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Info panel (bottom 43%) ───────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 bottom-0 flex flex-col" style={{
        height:'43%',
        background: hab.panelBg,
        backdropFilter:'blur(12px)',
        borderTop:'1px solid rgba(255,255,255,.15)',
        paddingBottom:'max(8px, env(safe-area-inset-bottom))',
      }}>
        {/* Today's goal */}
        {savedGoal && (
          <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background:'rgba(255,255,255,.08)' }}>
            <span style={{ fontSize:14 }}>🎯</span>
            <p className="text-xs text-white/75 font-medium">{savedGoal}</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white text-xs font-semibold">{current.name}</span>
            {next
              ? <span className="text-white/55 text-xs">{fmtShort(THRESHOLDS[stage+1]-balance)} to {next.name}</span>
              : <span className="text-white/55 text-xs">Max level 🌟</span>
            }
          </div>
          <div className="rounded-full overflow-hidden" style={{ height:6, background:'rgba(255,255,255,.14)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{
              width:`${Math.round(prog*100)}%`,
              background:`linear-gradient(to right, ${hab.badgeBorder}, rgba(255,255,255,.8))`,
              boxShadow:`0 0 8px ${hab.badgeBorder}`,
            }}/>
          </div>
        </div>

        {/* Spirit dialogue */}
        <div
          key={spiritText}
          className="mx-4 px-3 py-1.5 rounded-xl text-center text-xs font-medium"
          style={{ background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.9)', animation:'dialoguePop .3s ease', cursor:'pointer' }}
          onClick={handleHeroTap}
        >
          {spiritText}
        </div>

        {/* Locked stages strip */}
        {lockedStages.length > 0 && (
          <div className="mt-1.5">
            <p className="px-4 text-[9px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
              Locked — {lockedStages.length} remaining
            </p>
            <div className="flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth:'none' }}>
              {lockedStages.map((s, idx) => {
                const absIdx = stage + 1 + idx
                const isSel  = selectedLocked === absIdx
                const Sp     = SPRITES[absIdx]
                return (
                  <div
                    key={absIdx}
                    onClick={() => setSelected(isSel ? null : absIdx)}
                    className="flex-shrink-0 flex flex-col items-center rounded-xl cursor-pointer transition-all active:scale-95"
                    style={{
                      width:60, paddingTop:5, paddingBottom:5,
                      background: isSel ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.28)',
                      border:`1.5px solid ${isSel ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.06)'}`,
                    }}
                  >
                    <span className="text-white/25 font-bold" style={{ fontSize:8 }}>{absIdx}</span>
                    <div style={{ opacity:.25, filter:'grayscale(1)', marginTop:2 }}>
                      <Sp size={28}/>
                    </div>
                    <span className="text-white/20 font-semibold mt-0.5" style={{ fontSize:8 }}>???</span>
                    {isSel && (
                      <span className="text-white/55 mt-0.5 text-center px-1 leading-tight" style={{ fontSize:7 }}>
                        {fmtShort(THRESHOLDS[absIdx]-balance)} needed
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
            <FinCard label="Net Worth" value={fmtFull(balance)}       neg={balance<0}/>
            <FinCard label="Income"    value={fmtFull(monthlyIncome)} sub="this month"/>
            <FinCard label="Spend"     value={fmtFull(monthlySpend)}  sub="this month"/>
          </div>
        </div>
      </div>

      {/* ── Daily goal-setting overlay (Peak-style) ───────────────────────────── */}
      {showGoal && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{
          background:`linear-gradient(160deg, ${hab.skyFrom}F0, ${hab.groundTo}E8)`,
          backdropFilter:'blur(2px)',
        }}>
          {goalStep === 'intro' ? (
            <div className="text-center" style={{ animation:'introSlide .4s ease' }}>
              {/* Hero animal */}
              <div style={{ display:'flex', justifyContent:'center', marginBottom:20, animation:'heroGlow 2.5s ease-in-out infinite' }}>
                <Sprite size={90}/>
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-2" style={{ textShadow:'0 2px 8px rgba(0,0,0,.4)' }}>
                Hi! I&apos;m {current.name}.
              </h2>
              <p className="text-sm text-white/80 mb-2">Your <strong>{hab.name}</strong> companion.</p>
              <p className="text-sm text-white/70 mb-8 max-w-xs mx-auto leading-relaxed">
                {current.says}
              </p>
              <button
                onClick={() => setGoalStep('pick')}
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.4)', color:'white' }}
              >
                Set today&apos;s focus →
              </button>
              <button onClick={commitGoal} className="mt-3 text-xs text-white/40 underline">
                Skip
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm" style={{ animation:'goalPop .35s ease' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                <Sprite size={60}/>
              </div>
              <h3 className="text-xl font-extrabold text-white text-center mb-1">
                What&apos;s your focus today?
              </h3>
              <p className="text-xs text-white/55 text-center mb-5">{current.name} will cheer you on.</p>

              {/* Preset goals */}
              <div className="flex flex-col gap-2 mb-4">
                {DAILY_GOALS.map(g => (
                  <button
                    key={g.text}
                    onClick={() => setGoalChoice(g.text)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-left transition-all active:scale-95"
                    style={{
                      background: goalChoice === g.text ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.1)',
                      border: `1.5px solid ${goalChoice === g.text ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.12)'}`,
                      color:'white',
                    }}
                  >
                    <span style={{ fontSize:20 }}>{g.emoji}</span> {g.text}
                    {goalChoice === g.text && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <input
                type="text"
                placeholder="Or write your own…"
                value={customGoal}
                onChange={e => { setCustomGoal(e.target.value); setGoalChoice('') }}
                className="w-full px-4 py-3 rounded-2xl text-sm font-medium mb-4"
                style={{
                  background:'rgba(255,255,255,.1)',
                  border:'1.5px solid rgba(255,255,255,.2)',
                  color:'white', outline:'none',
                }}
              />

              <button
                onClick={commitGoal}
                disabled={!goalChoice && !customGoal}
                className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{
                  background: (goalChoice||customGoal) ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)',
                  border:'1.5px solid rgba(255,255,255,.35)',
                  color: (goalChoice||customGoal) ? 'white' : 'rgba(255,255,255,.3)',
                }}
              >
                Let&apos;s go, {current.name}! 🚀
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Stage-up overlay ─────────────────────────────────────────────────── */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background:'rgba(0,0,0,.84)', backdropFilter:'blur(10px)' }}
          onClick={() => setShowOverlay(false)}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {CONFETTI.map((c,i)=>(
              <div key={i} className="absolute w-2.5 h-2.5 rounded-sm" style={{
                left:`${c.left}%`, top:'-4%', backgroundColor:c.color,
                animation:`confettiFall ${c.duration}s ease-in ${c.delay}s both`,
                transform:`rotate(${c.rotation}deg)`,
              }}/>
            ))}
          </div>
          <div className="text-center px-6" style={{ animation:'evolveIn .5s ease-out both' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:16 }}>
              {(() => { const S = SPRITES[stage]; return <S size={100}/>; })()}
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:'rgba(255,255,255,.45)' }}>
              Evolution!
            </p>
            <h2 className="text-3xl font-extrabold text-white mb-1">
              You evolved into a {evolvedInto.name}!
            </h2>
            <p style={{ color:'rgba(255,255,255,.6)' }}>Stage {stage} · {HABITATS[STAGES[stage].habitat].name}</p>
            <p className="text-sm mt-8" style={{ color:'rgba(255,255,255,.3)' }}>Tap to continue</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scene decorations ─────────────────────────────────────────────────────────
function CloudShape({ color = 'white', scale = 1 }: { color?: string; scale?: number }) {
  return (
    <div style={{ transform:`scale(${scale})`, transformOrigin:'left top' }}>
      <svg width="92" height="48" viewBox="0 0 92 48">
        <ellipse cx="46" cy="38" rx="41" ry="12" fill={color}/>
        <ellipse cx="32" cy="28" rx="21" ry="17" fill={color}/>
        <ellipse cx="60" cy="26" rx="19" ry="16" fill={color}/>
      </svg>
    </div>
  )
}

function JungleTree() {
  return (
    <svg width="54" height="84" viewBox="0 0 54 84" fill="none">
      {/* trunk */}
      <path d="M27 82 Q25 62 28 44 Q30 24 27 12" stroke="#78350f" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {/* layered canopy */}
      <ellipse cx="27" cy="22" rx="20" ry="14" fill="#166534"/>
      <ellipse cx="27" cy="14" rx="14" ry="11" fill="#15803d"/>
      <ellipse cx="27" cy="8"  rx="9"  ry="8"  fill="#16a34a"/>
      {/* vine */}
      <path d="M36 30 Q42 44 38 58" stroke="#4ade80" strokeWidth="1.5" fill="none" opacity=".7"/>
    </svg>
  )
}

function AcaciaTree() {
  return (
    <svg width="56" height="78" viewBox="0 0 56 78" fill="none">
      {/* trunk with slight bend */}
      <path d="M28 76 Q26 58 30 40 Q32 28 28 18" stroke="#92400e" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
      {/* flat-top canopy */}
      <ellipse cx="28" cy="14" rx="24" ry="8" fill="#ca8a04"/>
      <ellipse cx="28" cy="11" rx="22" ry="6" fill="#d97706"/>
      <ellipse cx="16" cy="16" rx="12" ry="5" fill="#b45309"/>
      <ellipse cx="40" cy="16" rx="12" ry="5" fill="#b45309"/>
    </svg>
  )
}

function TallGrass({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 400 32" width="100%" height="32" preserveAspectRatio="none">
      {Array.from({length:28},(_,i)=>{
        const x = i*15+4
        return (
          <g key={i}>
            <path d={`M${x} 32 Q${x-4} ${14+i%6} ${x} ${6+i%8}`} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".8"/>
            <path d={`M${x+6} 32 Q${x+10} ${16+i%5} ${x+6} ${8+i%7}`} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" opacity=".6"/>
          </g>
        )
      })}
    </svg>
  )
}

function FinCard({ label,value,sub,neg }:{ label:string;value:string;sub?:string;neg?:boolean }) {
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
