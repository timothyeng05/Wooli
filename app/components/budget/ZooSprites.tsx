// SVG animal sprites for WooliBudget Zoo — one component per stage
// All sprites face RIGHT by default; the roam animation flips scaleX for leftward travel.

type SP = { size?: number }

// ── Ocean: stages 0-3 ($0 → $10K) ───────────────────────────────────────────

export function Plankton({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 54 48" fill="none">
      {/* translucent blob body */}
      <ellipse cx="27" cy="28" rx="15" ry="13" fill="#93c5fd" opacity="0.72"/>
      <ellipse cx="27" cy="27" rx="10" ry="8" fill="#bfdbfe" opacity="0.55"/>
      {/* cilia/tentacles */}
      <line x1="27" y1="15" x2="27" y2="8"  stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="18" x2="12" y2="12" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="18" x2="42" y2="12" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="28" x2="6"  y2="26" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="41" y1="28" x2="48" y2="26" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="38" x2="13" y2="44" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="38" x2="41" y2="44" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      {/* nucleus */}
      <circle cx="27" cy="28" r="5" fill="#dbeafe" opacity="0.6"/>
      {/* eyes */}
      <circle cx="23" cy="24" r="3"   fill="white"/>
      <circle cx="31" cy="24" r="3"   fill="white"/>
      <circle cx="23.8" cy="24" r="1.8" fill="#1e3a8a"/>
      <circle cx="31.8" cy="24" r="1.8" fill="#1e3a8a"/>
      <circle cx="24.3" cy="23.3" r=".7" fill="white"/>
      <circle cx="32.3" cy="23.3" r=".7" fill="white"/>
      {/* smile */}
      <path d="M22 31 Q27 35 32 31" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

export function Shrimp({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 56 50" fill="none">
      {/* curved body */}
      <path d="M12 42 Q10 30 18 22 Q26 14 38 16 Q48 18 48 28 Q48 38 40 42 Q30 46 20 44 Q14 42 12 42Z" fill="#fda4af"/>
      {/* segment lines */}
      <path d="M18 22 Q20 28 18 34" stroke="#fb7185" strokeWidth="1.2" fill="none"/>
      <path d="M24 18 Q26 26 24 34" stroke="#fb7185" strokeWidth="1.2" fill="none"/>
      <path d="M30 16 Q32 25 30 34" stroke="#fb7185" strokeWidth="1.2" fill="none"/>
      <path d="M36 16 Q38 25 36 34" stroke="#fb7185" strokeWidth="1.2" fill="none"/>
      {/* tail fan */}
      <path d="M12 42 L5 38 M12 42 L4 44 M12 42 L7 49" stroke="#fb7185" strokeWidth="2" strokeLinecap="round"/>
      {/* antennae */}
      <line x1="48" y1="24" x2="60" y2="12" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="47" y1="21" x2="58" y2="9"  stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round"/>
      {/* eye */}
      <circle cx="48" cy="24" r="3.5" fill="#1c1917"/>
      <circle cx="49" cy="23" r="1.2" fill="white"/>
      {/* walking legs */}
      <path d="M28 42 L24 49" stroke="#fb7185" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M32 43 L30 50" stroke="#fb7185" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M36 42 L36 49" stroke="#fb7185" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export function Clownfish({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 58 52" fill="none">
      {/* tail fin */}
      <path d="M10 22 L2 14 M10 26 L2 26 M10 30 L2 38" stroke="#1c1917" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10 18 Q4 22 4 26 Q4 30 10 34" fill="#f97316" stroke="#1c1917" strokeWidth="1.2"/>
      {/* body */}
      <ellipse cx="30" cy="26" rx="18" ry="14" fill="#f97316"/>
      <ellipse cx="30" cy="26" rx="18" ry="14" stroke="#1c1917" strokeWidth="1.5" fill="none"/>
      {/* white stripes */}
      <rect x="23" y="12" width="8" height="28" rx="4" fill="white"/>
      <rect x="23" y="12" width="8" height="28" rx="4" stroke="#1c1917" strokeWidth="1" fill="none"/>
      <rect x="38" y="14" width="5" height="24" rx="2.5" fill="white" opacity="0.7"/>
      {/* dorsal fin */}
      <path d="M26 12 Q29 4 38 6 Q42 14 40 14" fill="#f97316" stroke="#1c1917" strokeWidth="1.2"/>
      {/* pectoral fin */}
      <path d="M36 32 Q42 36 42 44 Q36 42 36 38" fill="#f97316" stroke="#1c1917" strokeWidth="1"/>
      {/* eye */}
      <circle cx="42" cy="22" r="4.5" fill="white"/>
      <circle cx="42" cy="22" r="3"   fill="#1c1917"/>
      <circle cx="43" cy="21" r="1"   fill="white"/>
      {/* smile */}
      <path d="M44 27 Q46 30 44 31" stroke="#1c1917" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function Pufferfish({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* spines */}
      {[
        [32,10,32,3],[19,14,14,8],[45,14,50,8],
        [11,26,4,23],[53,26,60,23],
        [11,40,4,43],[53,40,60,43],
        [19,51,14,57],[45,51,50,57],[32,54,32,61],
      ].map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0e7490" strokeWidth="1.8" strokeLinecap="round"/>
      ))}
      {/* body */}
      <circle cx="32" cy="32" r="20" fill="#06b6d4"/>
      {/* yellow belly */}
      <ellipse cx="32" cy="36" rx="13" ry="11" fill="#fef08a"/>
      {/* body dots */}
      {[[20,24],[44,24],[16,34],[48,34]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="2.2" fill="#0891b2"/>
      ))}
      {/* fins */}
      <path d="M13 32 Q8 27 10 22" fill="#0e7490"/>
      <path d="M51 32 Q56 27 54 22" fill="#0e7490"/>
      {/* eyes */}
      <circle cx="25" cy="26" r="5.5" fill="white"/>
      <circle cx="39" cy="26" r="5.5" fill="white"/>
      <circle cx="25" cy="26" r="3.5" fill="#1c1917"/>
      <circle cx="39" cy="26" r="3.5" fill="#1c1917"/>
      <circle cx="26" cy="25" r="1.4" fill="white"/>
      <circle cx="40" cy="25" r="1.4" fill="white"/>
      {/* mouth — grumpy line */}
      <path d="M26 37 L32 39 L38 37" stroke="#0e7490" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Jungle: stages 4-7 ($10K → $100K) ───────────────────────────────────────

export function TreeFrog({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      {/* back legs */}
      <path d="M14 48 Q8 54 12 60 Q17 57 20 52" fill="#22c55e" stroke="#15803d" strokeWidth="1"/>
      <path d="M46 48 Q52 54 48 60 Q43 57 40 52" fill="#22c55e" stroke="#15803d" strokeWidth="1"/>
      <circle cx="12" cy="60" r="3.5" fill="#4ade80"/>
      <circle cx="48" cy="60" r="3.5" fill="#4ade80"/>
      {/* body */}
      <ellipse cx="30" cy="44" rx="16" ry="12" fill="#22c55e"/>
      <ellipse cx="30" cy="44" rx="16" ry="12" stroke="#15803d" strokeWidth="1.5" fill="none"/>
      <ellipse cx="30" cy="46" rx="9"  ry="7"  fill="#bbf7d0"/>
      {/* front legs */}
      <path d="M16 46 Q10 51 14 57" fill="none" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M44 46 Q50 51 46 57" fill="none" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="14" cy="57" r="3.5" fill="#4ade80"/>
      <circle cx="46" cy="57" r="3.5" fill="#4ade80"/>
      {/* head */}
      <ellipse cx="30" cy="28" rx="15" ry="13" fill="#22c55e"/>
      <ellipse cx="30" cy="28" rx="15" ry="13" stroke="#15803d" strokeWidth="1.5" fill="none"/>
      {/* big bulging eyes */}
      <circle cx="21" cy="21" r="8" fill="#fef08a"/>
      <circle cx="39" cy="21" r="8" fill="#fef08a"/>
      <circle cx="21" cy="21" r="5" fill="#dc2626"/>
      <circle cx="39" cy="21" r="5" fill="#dc2626"/>
      <circle cx="21" cy="21" r="3.5" fill="#1c1917"/>
      <circle cx="39" cy="21" r="3.5" fill="#1c1917"/>
      <circle cx="22" cy="20" r="1.2" fill="white"/>
      <circle cx="40" cy="20" r="1.2" fill="white"/>
      {/* smile */}
      <path d="M23 34 Q30 38 37 34" stroke="#15803d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function Toucan({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 56 62" fill="none">
      {/* tail */}
      <path d="M10 50 L4 60 L14 56 L10 64" fill="#1c1917"/>
      {/* body */}
      <ellipse cx="24" cy="44" rx="14" ry="18" fill="#1c1917"/>
      {/* white chest */}
      <ellipse cx="24" cy="46" rx="9"  ry="12" fill="#f8fafc"/>
      {/* red belly flash */}
      <ellipse cx="24" cy="54" rx="7"  ry="5"  fill="#ef4444"/>
      {/* wing */}
      <path d="M12 40 Q9 30 12 22 Q16 28 16 38Z" fill="#292524"/>
      {/* head */}
      <circle cx="30" cy="22" r="13" fill="#1c1917"/>
      {/* eye ring */}
      <circle cx="32" cy="20" r="7"   fill="#4ade80"/>
      <circle cx="32" cy="20" r="4.5" fill="#1c1917"/>
      <circle cx="33" cy="19" r="1.8" fill="white"/>
      {/* HUGE beak */}
      <path d="M40 14 Q58 16 58 22 Q58 30 40 30 L36 26 L36 18 Z" fill="#f59e0b"/>
      <path d="M40 14 Q42 22 40 30" stroke="#d97706" strokeWidth="1.5" fill="none"/>
      <path d="M40 14 Q58 16 58 22 Q58 30 40 30" stroke="#92400e" strokeWidth="1.2" fill="none"/>
      <ellipse cx="55" cy="22" rx="3" ry="2" fill="#dc2626"/>
      {/* legs */}
      <line x1="20" y1="60" x2="18" y2="66" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 66 L18 66 L21 66" stroke="#78716c" strokeWidth="2" strokeLinecap="round"/>
      <line x1="28" y1="60" x2="30" y2="66" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M27 66 L30 66 L33 66" stroke="#78716c" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function Monkey({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      {/* curling tail */}
      <path d="M44 48 Q56 42 58 30 Q56 20 50 24" fill="none" stroke="#92400e" strokeWidth="3.5" strokeLinecap="round"/>
      {/* body */}
      <ellipse cx="28" cy="42" rx="14" ry="16" fill="#a16207"/>
      <ellipse cx="28" cy="44" rx="9"  ry="11" fill="#fef3c7"/>
      {/* arms */}
      <path d="M14 38 Q6 32 8 22 Q14 24 16 32" fill="#a16207" stroke="#92400e" strokeWidth="1"/>
      <path d="M42 38 Q50 32 48 22 Q42 24 40 32" fill="#a16207" stroke="#92400e" strokeWidth="1"/>
      <circle cx="8"  cy="22" r="4.5" fill="#92400e"/>
      <circle cx="48" cy="22" r="4.5" fill="#92400e"/>
      {/* legs */}
      <path d="M20 56 Q16 62 20 64 Q24 64 24 60" fill="#a16207" stroke="#92400e" strokeWidth="1"/>
      <path d="M36 56 Q40 62 36 64 Q32 64 32 60" fill="#a16207" stroke="#92400e" strokeWidth="1"/>
      {/* head */}
      <circle cx="28" cy="24" r="15" fill="#a16207"/>
      {/* ears */}
      <circle cx="13" cy="24" r="7" fill="#a16207"/>
      <circle cx="13" cy="24" r="4.5" fill="#fef3c7"/>
      <circle cx="43" cy="24" r="7" fill="#a16207"/>
      <circle cx="43" cy="24" r="4.5" fill="#fef3c7"/>
      {/* face */}
      <ellipse cx="28" cy="28" rx="10" ry="8" fill="#fef3c7"/>
      {/* eyes */}
      <circle cx="23" cy="21" r="4"   fill="#1c1917"/>
      <circle cx="33" cy="21" r="4"   fill="#1c1917"/>
      <circle cx="24" cy="20" r="1.5" fill="white"/>
      <circle cx="34" cy="20" r="1.5" fill="white"/>
      {/* nose */}
      <circle cx="28" cy="26" r="2.5" fill="#92400e"/>
      <circle cx="27" cy="26" r="1"   fill="#1c1917"/>
      <circle cx="29" cy="26" r="1"   fill="#1c1917"/>
      {/* smile */}
      <path d="M23 31 Q28 35 33 31" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function Tiger({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 62 62" fill="none">
      {/* tail */}
      <path d="M48 46 Q60 40 60 30 Q58 22 52 26" fill="none" stroke="#c2410c" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="52" cy="26" r="4" fill="#1c1917"/>
      {/* body */}
      <ellipse cx="28" cy="42" rx="17" ry="15" fill="#ea580c"/>
      <ellipse cx="28" cy="44" rx="10" ry="9"  fill="#fef3c7"/>
      {/* body stripes */}
      {[16,22,34,40].map((x,i)=>(
        <path key={i} d={`M${x} 30 Q${x+2} 40 ${x} 50`} stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      ))}
      {/* legs */}
      {[14,22,32,40].map((x,i)=>(
        <rect key={i} x={x} y="53" width="7" height="10" rx="3.5" fill="#ea580c"/>
      ))}
      {/* head */}
      <circle cx="28" cy="24" r="15" fill="#ea580c"/>
      {/* ears */}
      <path d="M16 15 L12 6 L22 13" fill="#ea580c"/><path d="M16 15 L13 8 L20 13" fill="#fda4af"/>
      <path d="M40 15 L44 6 L34 13" fill="#ea580c"/><path d="M40 15 L43 8 L36 13" fill="#fda4af"/>
      {/* face */}
      <ellipse cx="28" cy="28" rx="11" ry="9" fill="#fef3c7"/>
      {/* forehead stripe */}
      <path d="M28 10 Q30 15 28 20" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* face stripes */}
      <path d="M14 22 Q16 24 14 26" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M42 22 Q40 24 42 26" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* eyes */}
      <circle cx="22" cy="21" r="4.5" fill="#fbbf24"/>
      <circle cx="34" cy="21" r="4.5" fill="#fbbf24"/>
      <ellipse cx="22" cy="21" rx="2.5" ry="3.5" fill="#1c1917"/>
      <ellipse cx="34" cy="21" rx="2.5" ry="3.5" fill="#1c1917"/>
      <circle cx="23" cy="20" r="1.2" fill="white"/>
      <circle cx="35" cy="20" r="1.2" fill="white"/>
      {/* nose */}
      <path d="M24 28 L28 30 L32 28 L28 27 Z" fill="#e11d48"/>
      {/* whiskers */}
      {[[14,31,22,30],[14,33,22,32],[42,31,34,30],[42,33,34,32]].map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fef3c7" strokeWidth="1" strokeLinecap="round"/>
      ))}
    </svg>
  )
}

// ── Savanna: stages 8-10 ($100K → $1M) ──────────────────────────────────────

export function Zebra({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 60 66" fill="none">
      {/* tail */}
      <path d="M8 44 Q2 50 4 58" fill="none" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M4 58 Q4 62 6 62 Q8 62 8 58" fill="#1c1917"/>
      {/* legs */}
      {[12,20,30,38].map((x,i) => (
        <g key={i}>
          <rect x={x} y="50" width="7" height="14" rx="3.5" fill="white"/>
          <rect x={x} y="54" width="7" height="3" fill="#1c1917"/>
          <rect x={x} y="59" width="7" height="3" fill="#1c1917"/>
        </g>
      ))}
      {/* body */}
      <ellipse cx="28" cy="40" rx="20" ry="14" fill="white"/>
      <ellipse cx="28" cy="40" rx="20" ry="14" stroke="#1c1917" strokeWidth="1" fill="none"/>
      {/* body stripes */}
      {[
        'M16 28 Q14 36 16 44 Q18 46 18 44 Q16 36 18 28 Z',
        'M23 26 Q20 36 22 46 Q24 48 24 46 Q22 36 25 26 Z',
        'M31 26 Q28 36 30 46 Q32 48 32 46 Q30 36 33 26 Z',
        'M39 28 Q37 36 39 44 Q41 46 41 44 Q39 36 41 28 Z',
      ].map((d,i)=>(
        <path key={i} d={d} fill="#1c1917"/>
      ))}
      {/* neck */}
      <rect x="40" y="24" width="13" height="20" rx="6.5" fill="white"/>
      <rect x="40" y="24" width="13" height="20" rx="6.5" stroke="#1c1917" strokeWidth="1" fill="none"/>
      <line x1="40" y1="30" x2="53" y2="30" stroke="#1c1917" strokeWidth="2.5"/>
      <line x1="40" y1="37" x2="53" y2="37" stroke="#1c1917" strokeWidth="2.5"/>
      {/* mane */}
      <path d="M40 24 Q44 14 48 18 Q50 22 48 26" fill="#1c1917"/>
      <path d="M44 22 Q48 12 52 16 Q54 20 52 24" fill="#1c1917"/>
      {/* head */}
      <ellipse cx="52" cy="22" rx="9" ry="8" fill="white"/>
      <ellipse cx="52" cy="22" rx="9" ry="8" stroke="#1c1917" strokeWidth="1" fill="none"/>
      {/* head stripe */}
      <path d="M46 16 Q50 14 52 18" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* snout */}
      <ellipse cx="58" cy="24" rx="5" ry="4" fill="#ffe4d0"/>
      <circle cx="57" cy="24" r="1.2" fill="#1c1917"/>
      <circle cx="59" cy="24" r="1.2" fill="#1c1917"/>
      {/* eye */}
      <circle cx="50" cy="20" r="3.5" fill="#1c1917"/>
      <circle cx="51" cy="19" r="1.2" fill="white"/>
      {/* ear */}
      <path d="M46 16 L42 10 L50 14" fill="white" stroke="#1c1917" strokeWidth="1"/>
    </svg>
  )
}

export function Giraffe({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 60 78" fill="none">
      {/* legs */}
      {[12,20,30,38].map((x,i)=>(
        <g key={i}>
          <rect x={x} y="52" width="7" height="22" rx="3.5" fill="#f59e0b"/>
          <rect x={x} y="70" width="7" height="5"  rx="2"   fill="#92400e"/>
        </g>
      ))}
      {/* body */}
      <ellipse cx="28" cy="44" rx="20" ry="14" fill="#fbbf24"/>
      {/* body patches */}
      {[[18,38,6,5],[30,34,6,5],[42,40,5,4],[22,52,5,4],[36,52,5,4]].map(([cx,cy,rx,ry],i)=>(
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#92400e"/>
      ))}
      {/* long neck */}
      <rect x="44" y="14" width="12" height="34" rx="6" fill="#fbbf24"/>
      {/* neck patches */}
      {[[50,22,5,4],[48,34,5,4]].map(([cx,cy,rx,ry],i)=>(
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#92400e"/>
      ))}
      {/* head */}
      <ellipse cx="52" cy="14" rx="9" ry="8" fill="#fbbf24"/>
      {/* ossicones */}
      <line x1="47" y1="8" x2="45" y2="2" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="45" cy="2" r="2.5" fill="#92400e"/>
      <line x1="54" y1="8" x2="56" y2="2" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="56" cy="2" r="2.5" fill="#92400e"/>
      {/* snout */}
      <ellipse cx="58" cy="16" rx="5.5" ry="4" fill="#f59e0b"/>
      <circle cx="57" cy="16" r="1.2" fill="#92400e"/>
      <circle cx="59" cy="16" r="1.2" fill="#92400e"/>
      {/* eye */}
      <circle cx="50" cy="12" r="3.5" fill="#92400e"/>
      <circle cx="50" cy="12" r="2.5" fill="#1c1917"/>
      <circle cx="51" cy="11" r="1"   fill="white"/>
      {/* eyelashes */}
      <line x1="48" y1="9" x2="46" y2="7" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="50" y1="8" x2="50" y2="6" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export function Lion({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 62 62" fill="none">
      {/* tail */}
      <path d="M8 44 Q2 36 4 26 Q6 20 10 24" fill="none" stroke="#b45309" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="10" cy="24" r="5" fill="#92400e"/>
      {/* body */}
      <ellipse cx="30" cy="44" rx="19" ry="15" fill="#fbbf24"/>
      {/* legs */}
      {[12,20,30,38].map((x,i)=>(
        <rect key={i} x={x} y="54" width="7" height="10" rx="3.5" fill="#fbbf24"/>
      ))}
      <ellipse cx="30" cy="46" rx="11" ry="9" fill="#fef3c7"/>
      {/* big mane */}
      <circle cx="32" cy="26" r="20" fill="#b45309"/>
      {/* head */}
      <circle cx="32" cy="26" r="14" fill="#fbbf24"/>
      {/* ears inside mane */}
      <path d="M20 17 L16 9 L26 14" fill="#fbbf24"/>
      <path d="M44 17 L48 9 L38 14" fill="#fbbf24"/>
      <path d="M20 17 L17 11 L24 14" fill="#fda4af"/>
      <path d="M44 17 L47 11 L40 14" fill="#fda4af"/>
      {/* face */}
      <ellipse cx="32" cy="30" rx="11" ry="9" fill="#fef3c7"/>
      {/* eyes */}
      <circle cx="26" cy="24" r="4.5" fill="#fbbf24"/>
      <circle cx="38" cy="24" r="4.5" fill="#fbbf24"/>
      <ellipse cx="26" cy="24" rx="3"   ry="3.5" fill="#1c1917"/>
      <ellipse cx="38" cy="24" rx="3"   ry="3.5" fill="#1c1917"/>
      <circle cx="27" cy="23" r="1.2" fill="white"/>
      <circle cx="39" cy="23" r="1.2" fill="white"/>
      {/* nose */}
      <path d="M28 30 L32 32 L36 30 L32 28 Z" fill="#e11d48"/>
      {/* whiskers */}
      {[[16,32,24,31],[16,34,24,33],[48,32,40,31],[48,34,40,33]].map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fef3c7" strokeWidth="1.2" strokeLinecap="round"/>
      ))}
      {/* smile */}
      <path d="M28 34 Q32 38 36 34" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ── Mythical: stages 11-13 ($1M → $100M) ────────────────────────────────────

export function Griffin({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* wings */}
      <path d="M24 30 Q8 18 6 6 Q14 10 20 20 Q22 25 24 28" fill="#a78bfa" stroke="#7c3aed" strokeWidth="1.2"/>
      <path d="M24 30 Q10 38 6 50 Q14 46 20 38 Q22 34 24 32" fill="#a78bfa" stroke="#7c3aed" strokeWidth="1.2"/>
      {/* wing membrane */}
      <path d="M24 28 Q12 6 10 2 Q16 8 18 16 L24 30" fill="#c4b5fd" opacity="0.5"/>
      {/* lion body */}
      <ellipse cx="26" cy="44" rx="14" ry="11" fill="#fbbf24"/>
      <ellipse cx="26" cy="46" rx="9"  ry="7"  fill="#fef3c7"/>
      {/* lion tail */}
      <path d="M12 44 Q4 50 6 58" fill="none" stroke="#b45309" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="6" cy="58" r="5" fill="#92400e"/>
      {/* lion legs */}
      {[14,24].map((x,i)=>(
        <rect key={i} x={x} y="52" width="7" height="10" rx="3.5" fill="#fbbf24"/>
      ))}
      {/* eagle body */}
      <ellipse cx="40" cy="38" rx="13" ry="16" fill="#d97706"/>
      <path d="M32 28 Q34 36 32 44" fill="#92400e"/>
      <path d="M36 26 Q38 36 36 46" fill="#92400e"/>
      {/* eagle head — white (bald eagle) */}
      <circle cx="44" cy="22" r="12" fill="#d97706"/>
      <circle cx="44" cy="22" r="10" fill="white"/>
      {/* eye */}
      <circle cx="46" cy="20" r="4"   fill="#fbbf24"/>
      <circle cx="46" cy="20" r="2.5" fill="#1c1917"/>
      <circle cx="47" cy="19" r="1"   fill="white"/>
      {/* eagle beak */}
      <path d="M50 18 L62 20 L50 26 Z" fill="#f59e0b"/>
      <path d="M50 18 L62 20 L56 22" fill="#b45309"/>
      {/* talons */}
      <path d="M46 52 L44 58 M46 52 L48 58 M46 52 L50 56" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function Phoenix({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 62 64" fill="none">
      {/* flame tail */}
      <path d="M14 50 Q10 58 14 64 Q18 58 16 50" fill="#fbbf24"/>
      <path d="M20 52 Q16 62 22 66 Q26 58 22 50" fill="#f97316"/>
      <path d="M26 54 Q22 64 28 66 Q32 60 28 52" fill="#ef4444"/>
      {/* left wing — flame shape */}
      <path d="M24 30 Q8 16 6 4  Q14 8 18 18 Q21 24 24 28" fill="#ef4444"/>
      <path d="M24 30 Q10 30 4 38 Q8 44 18 40 Q22 38 24 34" fill="#f97316"/>
      {/* right wing */}
      <path d="M38 30 Q54 16 56 4  Q48 8 44 18 Q41 24 38 28" fill="#ef4444"/>
      <path d="M38 30 Q52 30 58 38 Q54 44 44 40 Q40 38 38 34" fill="#f97316"/>
      {/* body */}
      <ellipse cx="31" cy="38" rx="11" ry="16" fill="#f97316"/>
      <ellipse cx="31" cy="40" rx="6"  ry="10" fill="#fef08a"/>
      {/* head */}
      <circle cx="31" cy="22" r="11" fill="#ef4444"/>
      {/* flame crest */}
      <path d="M27 12 Q27 4 31 2  Q35 4 35 12" fill="#fbbf24"/>
      <path d="M23 14 Q21 6  25 4  Q27 8 27 12" fill="#f97316"/>
      <path d="M39 14 Q41 6  37 4  Q35 8 35 12" fill="#f97316"/>
      {/* eyes */}
      <circle cx="26" cy="22" r="4.5" fill="#fef08a"/>
      <circle cx="36" cy="22" r="4.5" fill="#fef08a"/>
      <circle cx="26" cy="22" r="3"   fill="#1c1917"/>
      <circle cx="36" cy="22" r="3"   fill="#1c1917"/>
      <circle cx="27" cy="21" r="1.2" fill="white"/>
      <circle cx="37" cy="21" r="1.2" fill="white"/>
      {/* beak */}
      <path d="M27 27 L31 30 L35 27 L31 25 Z" fill="#fbbf24"/>
      {/* glow */}
      <circle cx="31" cy="34" r="26" fill="#fbbf24" opacity="0.05"/>
    </svg>
  )
}

export function Dragon({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* tail */}
      <path d="M8 46 Q2 52 4 60 Q8 56 10 50" fill="#7c3aed"/>
      <path d="M8 46 Q0 48 2 56 Q8 54 10 50" fill="#6d28d9"/>
      {/* left wing */}
      <path d="M22 24 Q6 10 4 0  Q14 4 18 14 Q20 18 22 22" fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1.2"/>
      <path d="M22 24 Q8 24 2 32 Q6 38 16 34 Q20 32 22 28" fill="#7c3aed" stroke="#6d28d9" strokeWidth="1.2"/>
      <path d="M22 22 Q10 6 8 0 Q12 6 14 12 L22 24" fill="#a78bfa" opacity="0.45"/>
      {/* body */}
      <ellipse cx="28" cy="42" rx="17" ry="16" fill="#7c3aed"/>
      <ellipse cx="28" cy="44" rx="10" ry="11" fill="#c4b5fd"/>
      {/* belly scales */}
      <path d="M21 42 Q25 38 28 42 Q31 38 35 42 Q31 46 28 42 Q25 46 21 42" fill="#ddd6fe"/>
      {/* back spikes */}
      {[18,26,34].map((x,i)=>(
        <path key={i} d={`M${x} 28 L${x-3} 20 L${x+4} 26`} fill="#6d28d9"/>
      ))}
      {/* neck */}
      <path d="M36 28 Q46 20 50 16" stroke="#7c3aed" strokeWidth="11" strokeLinecap="round" fill="none"/>
      <path d="M36 28 Q46 20 50 16" stroke="#c4b5fd" strokeWidth="5"  strokeLinecap="round" fill="none"/>
      {/* head */}
      <ellipse cx="50" cy="14" rx="11" ry="9" fill="#7c3aed"/>
      {/* horns */}
      <path d="M44 8  L40 2  L46 6"  fill="#4c1d95"/>
      <path d="M52 8  L56 2  L50 6"  fill="#4c1d95"/>
      {/* snout */}
      <ellipse cx="58" cy="16" rx="7" ry="5" fill="#8b5cf6"/>
      <circle cx="56" cy="16" r="1.8" fill="#1c1917"/>
      <circle cx="59" cy="16" r="1.8" fill="#1c1917"/>
      {/* fire from nostrils */}
      <path d="M55 13 Q56 9 56 13"  fill="#f97316"/>
      <path d="M58 13 Q59 9 59 13"  fill="#ef4444"/>
      {/* eye */}
      <circle cx="48" cy="12" r="5"   fill="#fbbf24"/>
      <ellipse cx="48" cy="12" rx="2.5" ry="4" fill="#1c1917"/>
      <circle cx="49" cy="11" r="1.2" fill="white"/>
      {/* legs */}
      <path d="M14 54 Q12 60 16 62 Q20 60 18 54" fill="#7c3aed"/>
      <path d="M38 54 Q40 60 36 62 Q32 60 34 54" fill="#7c3aed"/>
      {/* claws */}
      <path d="M16 62 L14 66 M16 62 L18 66 M16 62 L20 64" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
      <path d="M36 62 L34 66 M36 62 L36 66 M36 62 L40 64" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Lookup table: stage index → sprite component ──────────────────────────────
export const SPRITES = [
  Plankton, Shrimp, Clownfish, Pufferfish,
  TreeFrog, Toucan, Monkey, Tiger,
  Zebra, Giraffe, Lion,
  Griffin, Phoenix, Dragon,
] as const

export type SpriteComponent = (typeof SPRITES)[number]
