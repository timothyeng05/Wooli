'use client'

import { useState, useEffect } from 'react'
import { SPRITES } from './ZooSprites'

// ── Stage & habitat definitions ───────────────────────────────────────────────
const STAGES = [
  { name: 'Sand Crab',        habitat: 0, min: 0,          says: 'Hey there! Even the mightiest castles start with one grain of sand. 🏖️' },
  { name: 'Sea Turtle',       habitat: 0, min: 1_000,      says: 'Slow and steady wins the race. $1K is your first shell! 🐢' },
  { name: 'Pelican',          habitat: 0, min: 5_000,      says: 'Soaring now! Keep filling that savings pouch. 🌊' },
  { name: 'Bunny',            habitat: 1, min: 10_000,     says: 'Hippity hop! $10K and thriving in the meadow. 🌿' },
  { name: 'Fox',              habitat: 1, min: 25_000,     says: 'Sly moves! $25K — you\'re outsmarting the average saver. 🦊' },
  { name: 'Deer',             habitat: 1, min: 50_000,     says: 'Graceful and growing. The forest awaits beyond the meadow. 🌸' },
  { name: 'Jellyfish',        habitat: 2, min: 75_000,     says: 'You\'ve dived into deep waters. $75K — glowing bright! ✨' },
  { name: 'Dolphin',         habitat: 2, min: 100_000,    says: 'Six figures! You\'re riding the wave. Keep the momentum. 🌊' },
  { name: 'Shark',            habitat: 2, min: 250_000,    says: 'Quarter million. You\'re apex predator territory now. 🦈' },
  { name: 'Penguin',          habitat: 3, min: 500_000,    says: 'Half a million in the arctic vault. Unshakeable. 🧊' },
  { name: 'Arctic Fox',       habitat: 3, min: 1_000_000,  says: 'Millionaire! The blizzard doesn\'t faze you anymore. ❄️' },
  { name: 'Polar Bear',       habitat: 3, min: 2_500_000,  says: 'Two and a half million. You are the apex of this climate. 🐾' },
  { name: 'Thunder Serpent',  habitat: 4, min: 5_000_000,  says: 'You\'ve reached the storm. $5M — pure electrical power. ⚡' },
  { name: 'Storm Dragon',     habitat: 4, min: 10_000_000, says: 'LEGENDARY. Ten million. The storm bows to you. 🐉' },
] as const

type Stage = (typeof STAGES)[number]

const THRESHOLDS = STAGES.map(s => s.min)
const STAGE_KEY  = 'wooli_zoo_stage'
const GOAL_KEY   = 'wooli_zoo_goal'
const GOAL_DATE  = 'wooli_zoo_goal_date'

// ── Habitat definitions ───────────────────────────────────────────────────────
const HABITATS = [
  {
    id: 'beach',
    name: 'Tropical Beach',
    skyFrom: '#87CEEB', skyTo: '#FFE082',
    groundFrom: '#F9A825', groundTo: '#F57F17',
    groundRadius: '35% 35% 0 0 / 8% 8% 0 0',
    textColor: '#0277BD',
    badgeBg: 'rgba(255,236,153,.9)', badgeBorder: '#F9A825', badgeText: '#5D4037',
    panelBg: 'rgba(2,119,189,.78)',
  },
  {
    id: 'grassland',
    name: 'Rolling Grasslands',
    skyFrom: '#0EA5E9', skyTo: '#BAE6FD',
    groundFrom: '#16A34A', groundTo: '#15803D',
    groundRadius: '45% 45% 0 0 / 6% 6% 0 0',
    textColor: '#0369A1',
    badgeBg: 'rgba(224,242,254,.9)', badgeBorder: '#38BDF8', badgeText: '#0369A1',
    panelBg: 'rgba(3,105,161,.78)',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    skyFrom: '#01579B', skyTo: '#0288D1',
    groundFrom: '#006064', groundTo: '#004D40',
    groundRadius: '50% 50% 0 0 / 6% 6% 0 0',
    textColor: '#B2EBF2',
    badgeBg: 'rgba(1,87,155,.88)', badgeBorder: '#4FC3F7', badgeText: '#E1F5FE',
    panelBg: 'rgba(0,77,64,.82)',
  },
  {
    id: 'blizzard',
    name: 'Arctic Blizzard',
    skyFrom: '#B0BEC5', skyTo: '#ECEFF1',
    groundFrom: '#E8EAF6', groundTo: '#C5CAE9',
    groundRadius: '40% 40% 0 0 / 5% 5% 0 0',
    textColor: '#1A237E',
    badgeBg: 'rgba(232,234,246,.95)', badgeBorder: '#7986CB', badgeText: '#1A237E',
    panelBg: 'rgba(26,35,126,.78)',
  },
  {
    id: 'electric',
    name: 'Storm Pinnacle',
    skyFrom: '#0D0020', skyTo: '#1A0040',
    groundFrom: '#4A148C', groundTo: '#311B92',
    groundRadius: '30% 30% 0 0 / 4% 4% 0 0',
    textColor: '#CE93D8',
    badgeBg: 'rgba(74,20,140,.92)', badgeBorder: '#CE93D8', badgeText: '#E040FB',
    panelBg: 'rgba(49,27,146,.85)',
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
  const isBeach    = current.habitat === 0
  const isOcean    = current.habitat === 2
  const isBlizzard = current.habitat === 3
  const isElectric = current.habitat === 4

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

        {/* Sun / Moon */}
        {!isElectric && (
          <div className="absolute rounded-full pointer-events-none" style={{
            width:isBeach?76:64, height:isBeach?76:64,
            top:22, right:22,
            background: isBlizzard
              ? 'radial-gradient(circle at 40% 40%,rgba(255,255,255,.9),rgba(200,210,230,.6))'
              : isOcean
                ? 'none'
                : 'radial-gradient(circle at 40% 40%,#FFFDE7,#FCD34D)',
            boxShadow: isBlizzard ? 'none' : `0 0 ${isBeach?44:28}px rgba(252,211,77,.5)`,
          }}/>
        )}

        {/* Ocean caustic light rays */}
        {isOcean && (
          <div className="absolute inset-0 pointer-events-none" style={{ opacity:.12 }}>
            {[15,30,50,65,80].map((x,i) => (
              <div key={i} style={{
                position:'absolute', top:0, left:`${x}%`,
                width:20, height:'100%',
                background:'linear-gradient(to bottom, #4FC3F7, transparent)',
                transform:`rotate(${(i-2)*5}deg)`, transformOrigin:'top center',
              }}/>
            ))}
          </div>
        )}

        {/* Clouds (not in ocean or electric) */}
        {!isOcean && !isElectric && (
          <>
            <div className="absolute pointer-events-none" style={{ top:50,left:'8%', animation:'cloudDrift 9s ease-in-out infinite' }}>
              <CloudShape color={isBlizzard ? 'rgba(200,210,230,.9)' : 'white'}/>
            </div>
            <div className="absolute pointer-events-none" style={{ top:88,left:'52%',transform:'scale(.6)', animation:'cloudDrift 13s ease-in-out 3s infinite' }}>
              <CloudShape color={isBlizzard ? 'rgba(200,210,230,.9)' : 'white'}/>
            </div>
          </>
        )}

        {/* Electric: storm clouds + lightning */}
        {isElectric && (
          <>
            <div className="absolute pointer-events-none" style={{ top:20, left:'5%' }}>
              <CloudShape color="rgba(100,50,160,.8)" scale={1.4}/>
            </div>
            <div className="absolute pointer-events-none" style={{ top:10, left:'50%' }}>
              <CloudShape color="rgba(80,30,140,.9)" scale={1.2}/>
            </div>
            {/* Lightning bolts */}
            {[18, 45, 72].map((x, i) => (
              <svg key={i} className="absolute pointer-events-none" style={{
                top:30, left:`${x}%`,
                animation:`lightning ${2+i*.7}s ${i*.5}s ease-in-out infinite`,
              }} width="24" height="60" viewBox="0 0 24 60">
                <path d="M14 0 L6 30 L12 30 L4 60" stroke="#E040FB" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 0 L6 30 L12 30 L4 60" stroke="#F3E5F5" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
              </svg>
            ))}
          </>
        )}

        {/* Blizzard: snowflakes */}
        {isBlizzard && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({length:20},(_,i)=>(
              <div key={i} style={{
                position:'absolute',
                left:`${(i*17+7)%100}%`, top:`${(i*13)%30}%`,
                fontSize:i%3===0?'14px':i%3===1?'10px':'8px',
                opacity:.6,
                animation:`snowfall ${3+i%4}s ${i*.3}s linear infinite`,
              }}>❄</div>
            ))}
          </div>
        )}

        {/* Ocean: bubbles */}
        {isOcean && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({length:12},(_,i)=>(
              <div key={i} style={{
                position:'absolute',
                left:`${(i*19+5)%90}%`, bottom:`${(i*13)%40}%`,
                width:6+i%6, height:6+i%6,
                borderRadius:'50%',
                border:'1.5px solid rgba(100,200,255,.4)',
                animation:`bubble ${2+i%3}s ${i*.4}s ease-out infinite`,
              }}/>
            ))}
          </div>
        )}

        {/* Beach: palm trees */}
        {isBeach && (
          <>
            <div className="absolute pointer-events-none" style={{ bottom:'32%', left:6 }}>
              <PalmTree/>
            </div>
            <div className="absolute pointer-events-none" style={{ bottom:'32%', right:10, transform:'scale(.75) scaleX(-1)' }}>
              <PalmTree/>
            </div>
          </>
        )}

        {/* Grassland: trees + fence */}
        {current.habitat === 1 && (
          <>
            <div className="absolute pointer-events-none" style={{ bottom:'33%', left:6 }}>
              <PineTree/>
            </div>
            <div className="absolute pointer-events-none" style={{ bottom:'33%', right:10, transform:'scale(.74)' }}>
              <PineTree/>
            </div>
            <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'31%' }}>
              <WoodFence/>
            </div>
          </>
        )}

        {/* Ocean/blizzard/electric: ground decorations */}
        {isOcean && (
          <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'29%' }}>
            <svg viewBox="0 0 400 30" width="100%" height="30" preserveAspectRatio="none">
              {[10,60,110,160,220,280,330,370].map((x,i)=>(
                <ellipse key={i} cx={x} cy={10} rx={8+i%5} ry={10+i%8} fill={i%2===0?'#4DB6AC':'#80CBC4'} opacity=".7"/>
              ))}
            </svg>
          </div>
        )}
        {isBlizzard && (
          <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'29%' }}>
            <svg viewBox="0 0 400 24" width="100%" height="24" preserveAspectRatio="none">
              {[0,1,2,3,4,5,6].map(i=>(
                <polygon key={i} points={`${i*60},24 ${i*60+30},2 ${i*60+60},24`} fill="#E8EAF6"/>
              ))}
            </svg>
          </div>
        )}
        {isElectric && (
          <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom:'29%' }}>
            <svg viewBox="0 0 400 20" width="100%" height="20" preserveAspectRatio="none">
              <path d="M0 20 L40 4 L80 18 L120 6 L160 20 L200 8 L240 18 L280 4 L320 16 L360 6 L400 20Z" fill="#7C4DFF"/>
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

function PalmTree() {
  return (
    <svg width="52" height="80" viewBox="0 0 52 80" fill="none">
      <path d="M26 78 Q24 60 28 40 Q30 20 26 10" stroke="#6D4C41" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M26 12 Q10 4 4 14 Q14 18 26 20Z" fill="#2E7D32"/>
      <path d="M26 12 Q42 4 48 14 Q38 18 26 20Z" fill="#388E3C"/>
      <path d="M26 16 Q16 8 18 22 Q22 20 26 20Z" fill="#43A047"/>
      <path d="M26 16 Q36 8 34 22 Q30 20 26 20Z" fill="#43A047"/>
      <path d="M26 18 Q26 6 30 4 Q32 12 26 20Z" fill="#2E7D32"/>
      <ellipse cx="26" cy="78" rx="6" ry="2" fill="#5D4037"/>
    </svg>
  )
}

function PineTree() {
  return (
    <svg width="46" height="74" viewBox="0 0 46 74" fill="none">
      <polygon points="23,2 46,47 0,47" fill="#15803D"/>
      <polygon points="23,18 44,58 2,58" fill="#16A34A" opacity=".8"/>
      <rect x="19" y="58" width="8" height="14" fill="#92400E" rx="1"/>
    </svg>
  )
}

function WoodFence() {
  return (
    <svg viewBox="0 0 400 44" width="100%" height="44" preserveAspectRatio="none">
      <rect x="0" y="8"  width="400" height="5" fill="#92400E" rx="1"/>
      <rect x="0" y="24" width="400" height="5" fill="#92400E" rx="1"/>
      {[0,1,2,3,4,5,6,7,8,9].map(i=>(
        <rect key={i} x={i*44+10} y="2" width="10" height="38" fill="#78350F" rx="2"/>
      ))}
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
