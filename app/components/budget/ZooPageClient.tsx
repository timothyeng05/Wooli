'use client'

import { useState, useEffect } from 'react'
import { PIG_SPRITES, HOUSE_SPRITES } from './ZooSprites'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORM_KEY        = 'wooli_zoo_form_v2'
const STREAK_KEY      = 'wooli_zoo_streak'
const LAST_FED_KEY    = 'wooli_zoo_last_fed'
const NAME_KEY        = 'wooli_zoo_pet_name'
const CHALLENGE_KEY   = 'wooli_zoo_challenge'
const CHALLENGE_MONTH = 'wooli_zoo_challenge_month'

// Balance thresholds → pig form index (into PIG_SPRITES)
const PIG_THRESHOLDS   = [0, 5_000, 50_000, 500_000, 5_000_000]
// Balance thresholds → house form index (into HOUSE_SPRITES)
const HOUSE_THRESHOLDS = [0, 5_000, 50_000, 500_000]

const FORM_LABELS = ['Piglet', 'Little Pig', 'Growing Pig', 'Plump Pig', 'Royal Pig']

const FORM_QUOTES = [
  'Every great journey starts with a single oink! 🐷',
  "You're growing! Keep saving and watch what happens. 💪",
  'The forest is your oyster. Keep going! 🌿',
  "Living large — you've come so far. 🏡",
  'Legendary status. The royal palace is yours! 👑',
]

const MONTHLY_CHALLENGES = [
  { emoji: '🥗', text: 'Save at least 10% of what I earn' },
  { emoji: '💰', text: 'Spend less than I make this month' },
  { emoji: '🎯', text: 'Cut one unnecessary expense' },
  { emoji: '📈', text: 'Savings go in before fun money' },
]

// ── Pure functions ─────────────────────────────────────────────────────────────

function getPigForm(balance: number): number {
  if (balance < 0) return 0
  let f = 0
  for (let i = 0; i < PIG_THRESHOLDS.length; i++) if (balance >= PIG_THRESHOLDS[i]) f = i
  return f
}

function getHouseForm(balance: number): number {
  let h = 0
  for (let i = 0; i < HOUSE_THRESHOLDS.length; i++) if (balance >= HOUSE_THRESHOLDS[i]) h = i
  return h
}

type Health = 'no_data' | 'low' | 'ok' | 'good' | 'great'

function getHealth(income: number, spend: number): Health {
  if (income <= 0) return 'no_data'
  const r = (income - spend) / income
  if (r < 0)    return 'low'
  if (r < 0.05) return 'ok'
  if (r < 0.20) return 'good'
  return 'great'
}

const HEALTH_VISUAL: Record<Health, { filter: string; roamMult: number; mood: string }> = {
  great:   { filter: 'brightness(1.18) saturate(1.35) drop-shadow(0 0 8px rgba(255,180,180,.6))', roamMult: 0.7,  mood: '😄' },
  good:    { filter: 'none',                                                                        roamMult: 1.0,  mood: '🙂' },
  ok:      { filter: 'brightness(0.9) saturate(0.7)',                                              roamMult: 1.5,  mood: '😐' },
  low:     { filter: 'brightness(0.82) saturate(0.5) sepia(0.2)',                                  roamMult: 2.2,  mood: '😴' },
  no_data: { filter: 'none',                                                                        roamMult: 1.0,  mood: '🙂' },
}

function getLifeEvent(income: number, spend: number): 'vacation' | 'big_saver' | null {
  if (income > 0 && spend > income * 1.5) return 'vacation'
  if (income > 0 && (income - spend) / income >= 0.30) return 'big_saver'
  return null
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

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { balance: number; monthlyIncome: number; monthlySpend: number }

export default function ZooPageClient({ balance, monthlyIncome, monthlySpend }: Props) {
  const pigForm    = getPigForm(balance)
  const houseForm  = getHouseForm(balance)
  const health     = getHealth(monthlyIncome, monthlySpend)
  const hv         = HEALTH_VISUAL[health]
  const lifeEvent  = getLifeEvent(monthlyIncome, monthlySpend)
  const PigSprite  = PIG_SPRITES[pigForm]
  const HouseSprite = HOUSE_SPRITES[houseForm]

  const nextThreshold = PIG_THRESHOLDS[pigForm + 1] ?? null
  const prog = nextThreshold
    ? Math.min((balance - PIG_THRESHOLDS[pigForm]) / (nextThreshold - PIG_THRESHOLDS[pigForm]), 1)
    : 1

  const [streak,          setStreak]          = useState(0)
  const [justFed,         setJustFed]         = useState(false)
  const [petName,         setPetName]         = useState('')
  const [nameInput,       setNameInput]       = useState('')
  const [showRename,      setShowRename]      = useState(false)
  const [showChallenge,   setShowChallenge]   = useState(false)
  const [challengeStep,   setChallengeStep]   = useState<'intro'|'pick'>('intro')
  const [challengeChoice, setChallengeChoice] = useState('')
  const [savedChallenge,  setSavedChallenge]  = useState('')
  const [tapped,          setTapped]          = useState(false)
  const [tapCount,        setTapCount]        = useState(0)
  const [grewUp,          setGrewUp]          = useState(false)

  useEffect(() => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7)

      setPetName(localStorage.getItem(NAME_KEY) ?? '')

      if (localStorage.getItem(CHALLENGE_MONTH) !== currentMonth) setShowChallenge(true)
      setSavedChallenge(localStorage.getItem(CHALLENGE_KEY) ?? '')

      const lastFed   = localStorage.getItem(LAST_FED_KEY) ?? ''
      const rawStreak = parseInt(localStorage.getItem(STREAK_KEY) ?? '0', 10)
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const yStr      = yesterday.toISOString().split('T')[0]
      setStreak(lastFed === yStr || lastFed === today() ? rawStreak : 0)

      const savedForm = parseInt(localStorage.getItem(FORM_KEY) ?? '-1', 10)
      if (pigForm > savedForm && savedForm >= 0) {
        setGrewUp(true)
        if ('vibrate' in navigator) navigator.vibrate(200)
        setTimeout(() => setGrewUp(false), 3000)
      }
      localStorage.setItem(FORM_KEY, String(pigForm))
    } catch { /* private mode */ }
  }, [balance, monthlyIncome, monthlySpend, pigForm])

  const commitChallenge = () => {
    const g = challengeChoice || 'Keep saving!'
    const currentMonth = new Date().toISOString().slice(0, 7)
    try {
      localStorage.setItem(CHALLENGE_KEY,   g)
      localStorage.setItem(CHALLENGE_MONTH, currentMonth)
      const lastFed   = localStorage.getItem(LAST_FED_KEY) ?? ''
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const yStr      = yesterday.toISOString().split('T')[0]
      const newStreak = lastFed === today() ? streak
                      : lastFed === yStr    ? streak + 1
                      : 1
      localStorage.setItem(STREAK_KEY,   String(newStreak))
      localStorage.setItem(LAST_FED_KEY, today())
      setStreak(newStreak)
    } catch { /* */ }
    setSavedChallenge(g)
    setShowChallenge(false)
    setChallengeChoice('')
    setChallengeStep('intro')
    setJustFed(true)
    setTimeout(() => setJustFed(false), 2000)
  }

  const handlePigTap = () => {
    setTapped(true); setTapCount(c => c + 1)
    if ('vibrate' in navigator) navigator.vibrate(40)
    setTimeout(() => setTapped(false), 550)
  }

  const saveName = () => {
    const n = nameInput.trim()
    if (n) {
      try { localStorage.setItem(NAME_KEY, n) } catch { /* */ }
      setPetName(n)
    }
    setShowRename(false); setNameInput('')
  }

  const displayName = petName || 'your pig'

  const spiritText =
    tapCount > 5               ? 'Hehe — stop poking me! 😤'
    : grewUp                   ? `${displayName} is growing up! 🎉 Look at that new house!`
    : justFed                  ? `Mmm, delicious! ${displayName} feels great! 🌟`
    : lifeEvent === 'vacation'  ? `Living it up! ✈️ Vegetables next month? 🥗`
    : lifeEvent === 'big_saver' ? `${displayName} is glowing! 💍 Amazing savings!`
    : health === 'low'          ? `${displayName} could use a bit more saving this month 🥕`
    : health === 'ok'           ? `Almost there — a little more saving would help! 🌱`
    : health === 'great'        ? `Well-fed and thriving! 🌟 ${FORM_QUOTES[pigForm]}`
    : FORM_QUOTES[pigForm]

  const roamDur = 10 * hv.roamMult
  const pigSize = balance < 0 ? 42 : 38 + pigForm * 6
  const debtFilter = balance < 0 ? 'hue-rotate(200deg) brightness(0.8) ' : ''
  const baseFilter = debtFilter + (hv.filter || '')

  const pigInnerStyle: React.CSSProperties = justFed
    ? { animation: 'fedBounce .6s ease, fedGlow 2s ease-in-out infinite',
        filter: 'brightness(1.4) saturate(1.5) drop-shadow(0 0 12px rgba(255,182,193,.9))' }
    : tapped
    ? { animation: 'tapPop .55s ease', filter: baseFilter }
    : { animation: `pigFace ${roamDur}s ease-in-out infinite, heroGlow 2.5s ease-in-out infinite`,
        filter: baseFilter }

  const houseSizes = [58, 72, 90, 110]

  return (
    <div className="relative overflow-hidden" style={{ minHeight: '100dvh', background: '#000a00' }}>

      <style>{`
        @keyframes tapPop      { 0%{transform:scale(1)} 30%{transform:scale(1.3) rotate(-8deg)} 60%{transform:scale(.92) rotate(5deg)} 100%{transform:scale(1)} }
        @keyframes dialoguePop { 0%{opacity:0;transform:scale(.85) translateY(6px)} 100%{opacity:1;transform:scale(1)} }
        @keyframes heroGlow    { 0%,100%{filter:drop-shadow(0 0 5px rgba(255,200,210,.4))} 50%{filter:drop-shadow(0 0 14px rgba(255,200,210,.85))} }
        @keyframes introSlide  { 0%{opacity:0;transform:translateX(60px)} 100%{opacity:1;transform:translateX(0)} }
        @keyframes goalPop     { 0%{opacity:0;transform:scale(.8)} 100%{opacity:1;transform:scale(1)} }
        @keyframes pigRoam     { 0%,100%{transform:translateX(0)} 45%,55%{transform:translateX(30vw)} }
        @keyframes pigFace     { 0%,43%{transform:scaleX(1)} 44%,56%{transform:scaleX(1) translateY(-4px)} 57%,100%{transform:scaleX(-1)} }
        @keyframes fedBounce   { 0%{transform:scale(1)} 25%{transform:scale(1.22) rotate(-5deg)} 50%{transform:scale(0.94)} 75%{transform:scale(1.1) rotate(3deg)} 100%{transform:scale(1)} }
        @keyframes fedGlow     { 0%,100%{filter:drop-shadow(0 0 6px rgba(255,182,193,.5))} 50%{filter:drop-shadow(0 0 20px rgba(255,182,193,1))} }
        @keyframes grewPop     { 0%{transform:scale(1)} 30%{transform:scale(1.35)} 60%{transform:scale(0.9)} 100%{transform:scale(1)} }
        @keyframes leafSway    { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
      `}</style>

      {/* ── Forest scene (top 57%) ─────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-0" style={{
        height: '57%', overflow: 'hidden',
        background: 'linear-gradient(to bottom,#0a2210,#1a5c2a)',
      }}>
        {/* Background pine trees */}
        <div style={{ position: 'absolute', bottom: '30%', left: '2%', opacity: .7 }}><PineTree height={90}/></div>
        <div style={{ position: 'absolute', bottom: '30%', left: '8%', opacity: .5, transform: 'scale(.75)' }}><PineTree height={75}/></div>
        <div style={{ position: 'absolute', bottom: '30%', right: '3%', opacity: .7, transform: 'scaleX(-1)' }}><PineTree height={85}/></div>
        <div style={{ position: 'absolute', bottom: '30%', right: '10%', opacity: .5, transform: 'scale(.7) scaleX(-1)' }}><PineTree height={70}/></div>
        <div style={{ position: 'absolute', bottom: '32%', left: '20%', opacity: .3, transform: 'scale(.55)' }}><PineTree height={60}/></div>
        <div style={{ position: 'absolute', bottom: '32%', right: '22%', opacity: .3, transform: 'scale(.5) scaleX(-1)' }}><PineTree height={58}/></div>

        {/* House */}
        <div style={{ position: 'absolute', bottom: '30%', right: '18%', zIndex: 2 }}>
          <HouseSprite size={houseSizes[houseForm]}/>
        </div>

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0" style={{
          height: '36%',
          background: 'linear-gradient(to bottom,#2d1a0a,#1a0a05)',
          borderRadius: '45% 45% 0 0 / 5% 5% 0 0',
        }}/>

        {/* Ground grass */}
        <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: '30%' }}>
          <TallGrass color="#1c5c1c"/>
        </div>

        {/* Pig */}
        <div style={{
          position: 'absolute', bottom: '30%', left: '12%', zIndex: 5,
          animation: grewUp ? 'grewPop .6s ease' : `pigRoam ${roamDur}s ease-in-out infinite`,
        }}>
          <div onClick={handlePigTap} style={{ cursor: 'pointer', position: 'relative', ...pigInnerStyle }}>
            <PigSprite size={pigSize}/>
            {lifeEvent === 'vacation' && (
              <span style={{ position: 'absolute', top: -8, left: -6, fontSize: 16, transform: 'rotate(-15deg)', pointerEvents: 'none' }}>🕶️</span>
            )}
            {lifeEvent === 'big_saver' && (
              <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 14, pointerEvents: 'none' }}>💍</span>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,.7)', fontWeight: 'bold',
            textShadow: '0 1px 3px rgba(0,0,0,.8)', marginTop: 2 }}>
            {hv.mood} {petName || 'your pig'}
          </div>
        </div>

        {/* Dappled light rays */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: .07 }}>
          {[15, 35, 55, 72].map((x, i) => (
            <div key={i} style={{ position: 'absolute', top: 0, left: `${x}%`, width: 28, height: '70%',
              background: 'linear-gradient(to bottom,#a3e635,transparent)',
              transform: `rotate(${(i - 2) * 4}deg)`, transformOrigin: 'top center',
              animation: `leafSway ${6 + i}s ${i}s ease-in-out infinite` }}/>
          ))}
        </div>
      </div>

      {/* ── Info panel (bottom 43%) ───────────────────────────────────────── */}
      <div className="absolute left-0 right-0 bottom-0 flex flex-col" style={{
        height: '43%',
        background: 'rgba(8,20,8,.9)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,.1)',
        paddingBottom: 'max(8px,env(safe-area-inset-bottom))',
      }}>

        {/* Challenge + streak chips */}
        <div className="flex items-center gap-2 px-4 mt-2 flex-wrap">
          {savedChallenge && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,.08)' }}>
              <span style={{ fontSize: 12 }}>🎯</span>
              <p className="text-xs text-white/70 font-medium truncate" style={{ maxWidth: 180 }}>{savedChallenge}</p>
            </div>
          )}
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,160,0,.12)', border: '1px solid rgba(255,160,0,.22)' }}>
              <span style={{ fontSize: 12 }}>🔥</span>
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,200,60,.9)' }}>{streak} day streak</p>
            </div>
          )}
        </div>

        {/* Pet name + rename */}
        <div className="px-4 mt-2 flex items-center gap-2">
          {showRename ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder={petName || 'Name your pig…'}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.3)', color: 'white', outline: 'none' }}
                autoFocus
              />
              <button onClick={saveName} className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(74,222,128,.22)', border: '1px solid rgba(74,222,128,.4)', color: '#86efac' }}>
                Save
              </button>
              <button onClick={() => setShowRename(false)} className="text-white/40 text-xs">✕</button>
            </div>
          ) : (
            <>
              <span className="text-white/80 text-sm font-bold">{petName || FORM_LABELS[pigForm]}</span>
              <button onClick={() => { setShowRename(true); setNameInput(petName) }}
                className="text-white/30 text-xs hover:text-white/60 transition-colors">✏️</button>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/60 text-xs font-semibold">{FORM_LABELS[pigForm]}</span>
            {nextThreshold
              ? <span className="text-white/45 text-xs">{fmtShort(nextThreshold - balance)} to grow</span>
              : <span className="text-white/45 text-xs">Royal status 👑</span>}
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,.12)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{
              width: `${Math.round(prog * 100)}%`,
              background: 'linear-gradient(to right,#4ade80,#86efac)',
              boxShadow: '0 0 8px rgba(74,222,128,.6)',
            }}/>
          </div>
        </div>

        {/* Spirit dialogue */}
        <div key={spiritText} className="mx-4 px-3 py-1.5 rounded-xl text-center text-xs font-medium cursor-pointer"
          style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.88)', animation: 'dialoguePop .3s ease' }}
          onClick={handlePigTap}>
          {spiritText}
        </div>

        {/* Finance cards */}
        <div className="px-4 mt-auto pt-2" style={{ maxWidth: 420, margin: 'auto', width: '100%' }}>
          <div className="grid grid-cols-3 gap-2">
            <FinCard label="Net Worth" value={fmtFull(balance)}       neg={balance < 0}/>
            <FinCard label="Income"    value={fmtFull(monthlyIncome)} sub="this month"/>
            <FinCard label="Spend"     value={fmtFull(monthlySpend)}  sub="this month"/>
          </div>
        </div>
      </div>

      {/* ── Monthly challenge overlay ──────────────────────────────────────── */}
      {showChallenge && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{ background: 'linear-gradient(160deg,#0a2210F0,#1a0a05E8)', backdropFilter: 'blur(2px)' }}>
          {challengeStep === 'intro' ? (
            <div className="text-center" style={{ animation: 'introSlide .4s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, animation: 'heroGlow 2.5s ease-in-out infinite' }}>
                <PigSprite size={90}/>
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
                Time to feed {displayName}! 🍃
              </h2>
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>
                {health === 'great'
                  ? `${displayName} is thriving — amazing work this month! 🌟`
                  : health === 'low'
                  ? `${displayName} could use more vegetables. Let's plan! 🥕`
                  : `${displayName} is ready for a good month. Let's go!`}
              </p>
              <p className="text-sm mb-8 max-w-xs mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,.55)' }}>
                {FORM_QUOTES[pigForm]}
              </p>
              <button onClick={() => setChallengeStep('pick')}
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'rgba(74,222,128,.18)', border: '1.5px solid rgba(74,222,128,.35)', color: 'white' }}>
                Choose this month&apos;s meal →
              </button>
              <button onClick={commitChallenge} className="mt-3 text-xs underline" style={{ color: 'rgba(255,255,255,.3)' }}>
                Skip for now
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm" style={{ animation: 'goalPop .35s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <PigSprite size={60}/>
              </div>
              <h3 className="text-xl font-extrabold text-white text-center mb-1">
                This month&apos;s meal plan
              </h3>
              <p className="text-xs text-center mb-5" style={{ color: 'rgba(255,255,255,.45)' }}>
                {health === 'great' ? `${displayName} is well-nourished — keep it up! 🌟`
                  : health === 'low'  ? `${displayName} needs more veggies — any saving helps! 🥕`
                  : `${displayName} will grow stronger with your commitment.`}
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {MONTHLY_CHALLENGES.map(g => (
                  <button key={g.text} onClick={() => setChallengeChoice(g.text)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-left transition-all active:scale-95"
                    style={{
                      background: challengeChoice === g.text ? 'rgba(74,222,128,.2)' : 'rgba(255,255,255,.1)',
                      border: `1.5px solid ${challengeChoice === g.text ? 'rgba(74,222,128,.6)' : 'rgba(255,255,255,.12)'}`,
                      color: 'white',
                    }}>
                    <span style={{ fontSize: 20 }}>{g.emoji}</span> {g.text}
                    {challengeChoice === g.text && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
              <button onClick={commitChallenge} disabled={!challengeChoice}
                className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{
                  background: challengeChoice ? 'rgba(74,222,128,.25)' : 'rgba(255,255,255,.08)',
                  border: '1.5px solid rgba(74,222,128,.35)',
                  color: challengeChoice ? 'white' : 'rgba(255,255,255,.3)',
                }}>
                Feed {displayName} this month! 🌿
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Scene decoration helpers ──────────────────────────────────────────────────

function PineTree({ height = 80 }: { height?: number }) {
  const w = Math.round(height * 0.55)
  return (
    <svg width={w} height={height} viewBox="0 0 44 80" fill="none">
      <rect x={18} y={55} width={8} height={25} rx={2} fill="#5c3d1e"/>
      <polygon points="22,4 4,34 40,34"  fill="#1a5c2a"/>
      <polygon points="22,20 2,50 42,50" fill="#166534"/>
      <polygon points="22,34 0,64 44,64" fill="#14532d"/>
    </svg>
  )
}

function TallGrass({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 400 28" width="100%" height="28" preserveAspectRatio="none">
      {Array.from({ length: 24 }, (_, i) => { const x = i * 17 + 4; return (
        <g key={i}>
          <path d={`M${x} 28 Q${x - 4} ${12 + i % 6} ${x} ${4 + i % 8}`} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".8"/>
          <path d={`M${x + 7} 28 Q${x + 11} ${14 + i % 5} ${x + 7} ${6 + i % 7}`} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" opacity=".6"/>
        </g>
      )})}
    </svg>
  )
}

function FinCard({ label, value, sub, neg }: { label: string; value: string; sub?: string; neg?: boolean }) {
  return (
    <div className="rounded-xl p-2.5 text-center border border-white/10" style={{ background: 'rgba(0,0,0,.22)' }}>
      <p className="font-semibold uppercase tracking-wide text-white/50" style={{ fontSize: 9 }}>{label}</p>
      <p className="font-bold leading-tight mt-0.5" style={{ fontSize: 11, color: neg ? '#FCA5A5' : 'white' }}>
        {neg ? '-' : ''}{value}
      </p>
      {sub && <p className="text-white/35 mt-0.5" style={{ fontSize: 9 }}>{sub}</p>}
    </div>
  )
}
