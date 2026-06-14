// SVG animal sprites for WooliBudget Zoo — one component per stage
// All sprites face RIGHT by default; the roam animation flips scaleX for leftward travel.
// Each uses a fixed viewBox; pass `size` to scale the rendered px dimensions.

type SP = { size?: number }

// ── Beach: stages 0-2 ─────────────────────────────────────────────────────────

export function SandCrab({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 54 44" fill="none">
      <ellipse cx="27" cy="28" rx="13" ry="10" fill="#E07840"/>
      <ellipse cx="27" cy="27" rx="10" ry="7.5" fill="#F09050"/>
      <path d="M17 24 Q27 20 37 24" stroke="#C05828" strokeWidth=".8" fill="none" opacity=".6"/>
      <path d="M14 29 Q27 25 40 29" stroke="#C05828" strokeWidth=".8" fill="none" opacity=".6"/>
      {/* eye stalks */}
      <line x1="22" y1="20" x2="20" y2="14" stroke="#E07840" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="20" cy="13" r="3.5" fill="#F09050"/>
      <circle cx="20" cy="12.5" r="2" fill="#111"/>
      <circle cx="21" cy="12" r=".8" fill="white"/>
      <line x1="32" y1="20" x2="34" y2="14" stroke="#E07840" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="34" cy="13" r="3.5" fill="#F09050"/>
      <circle cx="34" cy="12.5" r="2" fill="#111"/>
      <circle cx="35" cy="12" r=".8" fill="white"/>
      {/* claws */}
      <path d="M14 26 Q5 21 2 26 Q4 33 14 31Z" fill="#E07840"/>
      <path d="M14 26 Q8 23 7 26 Q8 30 14 29.5Z" fill="#F09050"/>
      <path d="M40 26 Q49 21 52 26 Q50 33 40 31Z" fill="#E07840"/>
      <path d="M40 26 Q46 23 47 26 Q46 30 40 29.5Z" fill="#F09050"/>
      {/* legs */}
      <path d="M19 37 Q16 43 14 42" stroke="#E07840" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M23 38 Q22 44 20 44" stroke="#E07840" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M31 38 Q32 44 34 44" stroke="#E07840" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M35 37 Q38 43 40 42" stroke="#E07840" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function SeaTurtle({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 56 45" fill="none">
      {/* shell */}
      <ellipse cx="26" cy="24" rx="16" ry="13" fill="#2E7D32"/>
      <ellipse cx="26" cy="24" rx="13" ry="10" fill="#388E3C"/>
      {/* shell hexagons */}
      <polygon points="26,14 31,17 31,23 26,26 21,23 21,17" fill="none" stroke="#1B5E20" strokeWidth="1.2" opacity=".7"/>
      <polygon points="26,22 29,24 29,28 26,30 23,28 23,24" fill="none" stroke="#1B5E20" strokeWidth="1" opacity=".5"/>
      <path d="M34 17 Q38 19 38 24 Q38 28 34 30" stroke="#1B5E20" strokeWidth="1" fill="none" opacity=".5"/>
      <path d="M18 17 Q14 19 14 24 Q14 28 18 30" stroke="#1B5E20" strokeWidth="1" fill="none" opacity=".5"/>
      {/* head */}
      <circle cx="42" cy="22" r="7" fill="#4CAF50"/>
      <circle cx="44" cy="20" r="2" fill="#1A1A1A"/>
      <circle cx="44.8" cy="19.4" r=".7" fill="white"/>
      {/* flippers */}
      <ellipse cx="12" cy="14" rx="7" ry="4" fill="#388E3C" transform="rotate(-30 12 14)"/>
      <ellipse cx="12" cy="34" rx="7" ry="4" fill="#388E3C" transform="rotate(30 12 34)"/>
      <ellipse cx="40" cy="10" rx="5" ry="3" fill="#388E3C" transform="rotate(-50 40 10)"/>
      <ellipse cx="40" cy="38" rx="5" ry="3" fill="#388E3C" transform="rotate(50 40 38)"/>
      {/* smile */}
      <path d="M40 23 Q42 26 44 23" stroke="#1B5E20" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function Pelican({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 44 48" fill="none">
      {/* body */}
      <ellipse cx="20" cy="32" rx="13" ry="11" fill="#ECEFF1"/>
      <ellipse cx="20" cy="34" rx="9" ry="7" fill="#CFD8DC"/>
      {/* wings hint */}
      <path d="M8 28 Q4 24 6 20 L12 30Z" fill="#B0BEC5"/>
      <path d="M32 28 Q36 24 34 20 L28 30Z" fill="#B0BEC5"/>
      {/* head */}
      <circle cx="28" cy="16" r="9" fill="#ECEFF1"/>
      <ellipse cx="28" cy="13" rx="6" ry="4" fill="#CFD8DC"/>
      {/* eye */}
      <circle cx="32" cy="15" r="2.5" fill="#FFF176"/>
      <circle cx="32" cy="15" r="1.5" fill="#111"/>
      <circle cx="32.6" cy="14.5" r=".6" fill="white"/>
      {/* beak — long orange with pouch */}
      <path d="M34 17 L48 20 L44 24 L34 21Z" fill="#FF8F00"/>
      {/* pouch */}
      <path d="M34 20 Q39 28 38 24 Q36 30 34 21Z" fill="#EF6C00"/>
      {/* legs */}
      <line x1="18" y1="42" x2="16" y2="48" stroke="#FF8F00" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 48 L16 48 L19 48" stroke="#FF8F00" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="42" x2="26" y2="48" stroke="#FF8F00" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M23 48 L26 48 L29 48" stroke="#FF8F00" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Grassland: stages 3-5 ─────────────────────────────────────────────────────

export function Bunny({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* ears */}
      <ellipse cx="15" cy="9" rx="4" ry="9" fill="#90A4AE"/>
      <ellipse cx="15" cy="9" rx="2.2" ry="7" fill="#F48FB1"/>
      <ellipse cx="27" cy="7" rx="4" ry="9" fill="#90A4AE"/>
      <ellipse cx="27" cy="7" rx="2.2" ry="7" fill="#F48FB1"/>
      {/* body */}
      <ellipse cx="22" cy="33" rx="13" ry="10" fill="#B0BEC5"/>
      <ellipse cx="22" cy="34" rx="9" ry="7" fill="#CFD8DC"/>
      {/* head */}
      <circle cx="30" cy="22" r="10" fill="#B0BEC5"/>
      {/* cheeks */}
      <circle cx="34" cy="24" r="3.5" fill="#F48FB1" opacity=".45"/>
      {/* eyes */}
      <circle cx="33" cy="20" r="2.5" fill="#1A1A1A"/>
      <circle cx="33.8" cy="19.4" r=".9" fill="white"/>
      {/* nose */}
      <ellipse cx="36" cy="23" rx="1.5" ry="1" fill="#F48FB1"/>
      {/* mouth */}
      <path d="M34 24 Q36 26 38 24" stroke="#999" strokeWidth=".8" fill="none" strokeLinecap="round"/>
      {/* whiskers */}
      <line x1="37" y1="22" x2="43" y2="21" stroke="#90A4AE" strokeWidth=".8" opacity=".7"/>
      <line x1="37" y1="23" x2="43" y2="23.5" stroke="#90A4AE" strokeWidth=".8" opacity=".7"/>
      {/* tail */}
      <circle cx="8" cy="33" r="4.5" fill="#ECEFF1"/>
      {/* feet */}
      <ellipse cx="17" cy="43" rx="5" ry="2.5" fill="#90A4AE"/>
      <ellipse cx="27" cy="43" rx="5" ry="2.5" fill="#90A4AE"/>
    </svg>
  )
}

export function Fox({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 46" fill="none">
      {/* tail */}
      <path d="M4 38 Q0 28 6 22 Q10 32 12 36Z" fill="#EF6C00"/>
      <path d="M4 38 Q2 32 6 28 Q8 34 10 36Z" fill="#FFCC80"/>
      {/* body */}
      <ellipse cx="24" cy="32" rx="14" ry="11" fill="#EF6C00"/>
      <ellipse cx="26" cy="34" rx="8" ry="6" fill="#FFCC80"/>
      {/* ears */}
      <polygon points="28,12 23,4 19,13" fill="#EF6C00"/>
      <polygon points="28,12 24,6 21,13" fill="#D84315"/>
      <polygon points="38,10 34,3 31,11" fill="#EF6C00"/>
      <polygon points="38,10 35,5 33,11" fill="#D84315"/>
      {/* head */}
      <ellipse cx="32" cy="19" rx="12" ry="10" fill="#EF6C00"/>
      {/* muzzle */}
      <ellipse cx="38" cy="22" rx="7" ry="5" fill="#FFCC80"/>
      {/* eyes */}
      <circle cx="30" cy="17" r="2.5" fill="#1A1A1A"/>
      <circle cx="30.8" cy="16.4" r=".9" fill="white"/>
      {/* nose */}
      <ellipse cx="40" cy="21" rx="1.8" ry="1.2" fill="#BF360C"/>
      {/* mouth */}
      <path d="M38 23 Q40 25 42 23" stroke="#BF360C" strokeWidth="1" fill="none" strokeLinecap="round"/>
      {/* legs */}
      <ellipse cx="18" cy="43" rx="4" ry="2" fill="#E65100"/>
      <ellipse cx="30" cy="43" rx="4" ry="2" fill="#E65100"/>
    </svg>
  )
}

export function Deer({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* antlers */}
      <path d="M30 8 L28 2 M28 2 L24 0 M28 2 L32 0" stroke="#795548" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M38 10 L40 4 M40 4 L36 2 M40 4 L44 2" stroke="#795548" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* ears */}
      <ellipse cx="26" cy="12" rx="4" ry="6" fill="#A1887F" transform="rotate(-20 26 12)"/>
      <ellipse cx="26" cy="12" rx="2.5" ry="4" fill="#FFCCBC" transform="rotate(-20 26 12)"/>
      <ellipse cx="37" cy="12" rx="4" ry="6" fill="#A1887F" transform="rotate(15 37 12)"/>
      <ellipse cx="37" cy="12" rx="2.5" ry="4" fill="#FFCCBC" transform="rotate(15 37 12)"/>
      {/* body */}
      <ellipse cx="22" cy="34" rx="14" ry="10" fill="#8D6E63"/>
      {/* white spots */}
      <circle cx="18" cy="30" r="2.5" fill="white" opacity=".7"/>
      <circle cx="26" cy="28" r="2" fill="white" opacity=".7"/>
      <circle cx="14" cy="35" r="1.8" fill="white" opacity=".6"/>
      {/* neck */}
      <path d="M28 24 Q34 20 36 16 Q38 18 36 22 Q34 26 30 28Z" fill="#8D6E63"/>
      {/* head */}
      <ellipse cx="38" cy="16" rx="9" ry="8" fill="#A1887F"/>
      {/* snout */}
      <ellipse cx="44" cy="18" rx="4.5" ry="3.5" fill="#BCAAA4"/>
      {/* eye */}
      <circle cx="37" cy="13" r="2.5" fill="#1A1A1A"/>
      <circle cx="37.8" cy="12.4" r=".9" fill="white"/>
      {/* nose */}
      <ellipse cx="46" cy="17" rx="1.5" ry="1" fill="#5D4037"/>
      {/* legs */}
      <line x1="16" y1="42" x2="15" y2="48" stroke="#6D4C41" strokeWidth="3" strokeLinecap="round"/>
      <line x1="22" y1="43" x2="21" y2="48" stroke="#6D4C41" strokeWidth="3" strokeLinecap="round"/>
      <line x1="28" y1="43" x2="29" y2="48" stroke="#6D4C41" strokeWidth="3" strokeLinecap="round"/>
      <line x1="34" y1="42" x2="35" y2="47" stroke="#6D4C41" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

// ── Ocean: stages 6-8 ─────────────────────────────────────────────────────────

export function Jellyfish({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 44 57" fill="none">
      {/* glow halo */}
      <ellipse cx="22" cy="18" rx="20" ry="18" fill="#E040FB" opacity=".15"/>
      {/* bell/dome */}
      <path d="M2 20 Q2 4 22 4 Q42 4 42 20 Q42 26 22 28 Q2 26 2 20Z" fill="#CE93D8"/>
      <path d="M6 20 Q6 10 22 10 Q38 10 38 20 Q38 24 22 25 Q6 24 6 20Z" fill="#E040FB"/>
      {/* inner glow */}
      <ellipse cx="22" cy="16" rx="10" ry="8" fill="#F3E5F5" opacity=".4"/>
      <ellipse cx="22" cy="15" rx="5" ry="4" fill="white" opacity=".25"/>
      {/* eyes */}
      <circle cx="18" cy="17" r="2" fill="#6A1B9A"/>
      <circle cx="18.7" cy="16.5" r=".7" fill="white"/>
      <circle cx="26" cy="17" r="2" fill="#6A1B9A"/>
      <circle cx="26.7" cy="16.5" r=".7" fill="white"/>
      {/* tentacles — wavy paths */}
      <path d="M10 28 Q8 35 10 40 Q12 45 10 52" stroke="#CE93D8" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M15 29 Q13 36 15 42 Q16 48 14 56" stroke="#E040FB" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M20 30 Q18 38 20 44 Q22 50 20 57" stroke="#CE93D8" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M25 30 Q27 38 25 44 Q24 50 26 57" stroke="#E040FB" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M30 29 Q32 36 30 42 Q28 48 30 56" stroke="#CE93D8" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M35 28 Q37 35 35 40 Q33 46 35 52" stroke="#E040FB" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function Dolphin({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 58 42" fill="none">
      {/* tail flukes */}
      <path d="M2 20 Q0 14 5 16 Q4 21 9 19 Q4 24 0 26 Q5 28 2 20Z" fill="#546E7A"/>
      {/* body */}
      <path d="M8 20 Q16 8 34 12 Q50 14 56 20 Q50 26 34 28 Q16 32 8 20Z" fill="#607D8B"/>
      {/* belly */}
      <path d="M14 20 Q22 14 36 16 Q48 17 54 20 Q48 23 36 24 Q22 26 14 20Z" fill="#ECEFF1"/>
      {/* dorsal fin */}
      <path d="M28 12 Q30 4 36 8 Q34 12 32 13Z" fill="#546E7A"/>
      {/* eye */}
      <circle cx="48" cy="19" r="2.5" fill="#1A1A1A"/>
      <circle cx="48.7" cy="18.4" r=".9" fill="white"/>
      {/* smile */}
      <path d="M50 21 Q53 24 56 21" stroke="#546E7A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* beak */}
      <path d="M52 19 L58 20 L52 21Z" fill="#607D8B"/>
      {/* side fin */}
      <path d="M26 22 Q20 30 22 34 Q28 28 28 24Z" fill="#546E7A"/>
    </svg>
  )
}

export function Shark({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 60 43" fill="none">
      {/* tail */}
      <path d="M2 18 Q0 12 6 16 L8 21 L6 26 Q0 30 2 24Z" fill="#546E7A"/>
      {/* body */}
      <path d="M7 21 Q18 9 36 12 Q52 14 58 21 Q52 28 36 30 Q18 33 7 21Z" fill="#607D8B"/>
      {/* white belly */}
      <path d="M16 21 Q26 16 40 18 Q52 19 57 21 Q52 24 40 25 Q26 26 16 21Z" fill="#ECEFF1"/>
      {/* dorsal fin — big and menacing */}
      <path d="M24 12 Q28 1 36 8 Q34 12 30 13Z" fill="#546E7A"/>
      {/* gills */}
      <path d="M20 17 Q18 21 20 25" stroke="#455A64" strokeWidth="1.2" fill="none"/>
      <path d="M24 16 Q22 21 24 26" stroke="#455A64" strokeWidth="1.2" fill="none"/>
      {/* pec fin */}
      <path d="M28 24 Q22 34 20 38 Q28 32 30 26Z" fill="#546E7A"/>
      {/* eye */}
      <circle cx="50" cy="19" r="3" fill="#1A1A1A"/>
      <circle cx="50.8" cy="18.3" r="1" fill="white"/>
      {/* teeth */}
      <path d="M52 22 L54 25 L56 22 L58 25 L60 22" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      {/* nostril slits */}
      <path d="M47 17 L46 16" stroke="#455A64" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

// ── Blizzard: stages 9-11 ─────────────────────────────────────────────────────

export function Penguin({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 48" fill="none">
      {/* body */}
      <ellipse cx="19" cy="34" rx="13" ry="12" fill="#1A237E"/>
      {/* white belly */}
      <ellipse cx="19" cy="36" rx="8.5" ry="9" fill="#ECEFF1"/>
      {/* head */}
      <circle cx="19" cy="17" r="11" fill="#1A237E"/>
      {/* face white patch */}
      <ellipse cx="19" cy="19" rx="7" ry="6" fill="#ECEFF1"/>
      {/* eyes */}
      <circle cx="16" cy="15" r="3" fill="white"/>
      <circle cx="16" cy="15" r="1.8" fill="#111"/>
      <circle cx="16.6" cy="14.4" r=".7" fill="white"/>
      <circle cx="22" cy="15" r="3" fill="white"/>
      <circle cx="22" cy="15" r="1.8" fill="#111"/>
      <circle cx="22.6" cy="14.4" r=".7" fill="white"/>
      {/* beak */}
      <path d="M16 20 L19 25 L22 20Z" fill="#FF8F00"/>
      {/* wings */}
      <path d="M6 30 Q2 24 5 18 L8 34Z" fill="#0D47A1"/>
      <path d="M32 30 Q36 24 33 18 L30 34Z" fill="#0D47A1"/>
      {/* feet */}
      <path d="M13 44 Q10 48 8 47 Q10 43 13 44Z" fill="#FF8F00"/>
      <path d="M15 44 Q14 48 12 47 Q14 43 15 44Z" fill="#FF8F00"/>
      <path d="M23 44 Q26 48 28 47 Q26 43 23 44Z" fill="#FF8F00"/>
      <path d="M25 44 Q28 48 30 47 Q28 43 25 44Z" fill="#FF8F00"/>
    </svg>
  )
}

export function ArcticFox({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 46" fill="none">
      {/* fluffy tail */}
      <ellipse cx="6" cy="34" rx="7" ry="9" fill="#ECEFF1"/>
      <ellipse cx="6" cy="34" rx="4.5" ry="6" fill="white"/>
      {/* body */}
      <ellipse cx="24" cy="32" rx="14" ry="11" fill="#ECEFF1"/>
      <ellipse cx="24" cy="34" rx="10" ry="7.5" fill="white"/>
      {/* ears */}
      <polygon points="26,12 21,4 18,13" fill="#ECEFF1"/>
      <polygon points="26,12 22,6 20,13" fill="#FFCDD2"/>
      <polygon points="36,11 32,4 30,12" fill="#ECEFF1"/>
      <polygon points="36,11 33,6 31,12" fill="#FFCDD2"/>
      {/* head */}
      <ellipse cx="33" cy="19" rx="12" ry="10" fill="#ECEFF1"/>
      {/* muzzle */}
      <ellipse cx="40" cy="22" rx="7" ry="5" fill="white"/>
      {/* ice-blue eyes */}
      <circle cx="31" cy="17" r="3" fill="#B3E5FC"/>
      <circle cx="31" cy="17" r="1.8" fill="#0277BD"/>
      <circle cx="31.7" cy="16.4" r=".7" fill="white"/>
      {/* nose */}
      <ellipse cx="42" cy="21" rx="2" ry="1.3" fill="#EF9A9A"/>
      {/* paws */}
      <ellipse cx="18" cy="43" rx="4.5" ry="2" fill="#ECEFF1"/>
      <ellipse cx="30" cy="43" rx="4.5" ry="2" fill="#ECEFF1"/>
    </svg>
  )
}

export function PolarBear({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 50" fill="none">
      {/* body — big and round */}
      <ellipse cx="26" cy="36" rx="18" ry="14" fill="#ECEFF1"/>
      <ellipse cx="26" cy="38" rx="13" ry="9.5" fill="white"/>
      {/* round ears */}
      <circle cx="14" cy="13" r="6" fill="#ECEFF1"/>
      <circle cx="14" cy="13" r="3.5" fill="#E0E0E0"/>
      <circle cx="28" cy="11" r="6" fill="#ECEFF1"/>
      <circle cx="28" cy="11" r="3.5" fill="#E0E0E0"/>
      {/* big fluffy head */}
      <circle cx="22" cy="22" r="16" fill="#ECEFF1"/>
      {/* snout */}
      <ellipse cx="32" cy="26" rx="10" ry="7" fill="#E0E0E0"/>
      {/* eyes */}
      <circle cx="18" cy="19" r="3" fill="#1A1A1A"/>
      <circle cx="18.8" cy="18.3" r="1" fill="white"/>
      {/* nose — big black */}
      <ellipse cx="34" cy="24" rx="3.5" ry="2.5" fill="#111"/>
      <circle cx="33" cy="23.5" r=".8" fill="#333"/>
      {/* smile */}
      <path d="M30 27 Q34 30 38 27" stroke="#999" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {/* big paws */}
      <ellipse cx="12" cy="48" rx="6" ry="2.5" fill="#ECEFF1"/>
      <ellipse cx="38" cy="48" rx="6" ry="2.5" fill="#ECEFF1"/>
      {/* arm */}
      <ellipse cx="42" cy="36" rx="5" ry="8" fill="#E0E0E0" transform="rotate(20 42 36)"/>
    </svg>
  )
}

// ── Electric Storm: stages 12-13 ─────────────────────────────────────────────

export function ThunderSerpent({ size = 48 }: SP) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 72 40" fill="none">
      {/* body — wavy serpent */}
      <path d="M2 20 Q8 10 16 20 Q24 30 32 20 Q40 10 48 20 Q56 30 62 22" stroke="#FDD835" strokeWidth="10" fill="none" strokeLinecap="round"/>
      <path d="M2 20 Q8 10 16 20 Q24 30 32 20 Q40 10 48 20 Q56 30 62 22" stroke="#FFEE58" strokeWidth="7" fill="none" strokeLinecap="round"/>
      {/* lightning bolt scales */}
      <path d="M18 16 L16 20 L19 20 L17 24" stroke="#F57F17" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M32 20 L30 16 L33 16 L31 12" stroke="#F57F17" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M46 16 L44 20 L47 20 L45 24" stroke="#F57F17" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* head */}
      <ellipse cx="66" cy="21" rx="8" ry="6" fill="#FDD835"/>
      <ellipse cx="70" cy="22" rx="5" ry="4" fill="#FFEE58"/>
      {/* electric eyes */}
      <circle cx="67" cy="19" r="2.5" fill="#FFEB3B"/>
      <circle cx="67" cy="19" r="1.5" fill="#F57F17"/>
      <circle cx="67.6" cy="18.4" r=".6" fill="white"/>
      {/* forked tongue */}
      <path d="M74 22 L78 21 M74 22 L78 23" stroke="#F57F17" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* electric sparks */}
      <path d="M10 12 L12 8 L14 12" stroke="#FFF176" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M44 28 L46 32 L48 28" stroke="#FFF176" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function StormDragon({ size = 48 }: SP) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 54" fill="none">
      {/* lightning wings */}
      <path d="M28 22 Q14 10 2 14 Q10 20 16 26 Q12 28 8 32 Q18 28 22 24Z" fill="#5C35A0"/>
      <path d="M28 22 Q14 10 2 14 Q10 20 16 26 Q12 28 8 32 Q18 28 22 24Z" stroke="#B39DDB" strokeWidth="1" fill="none"/>
      <path d="M28 22 Q42 10 54 14 Q46 20 40 26 Q44 28 48 32 Q38 28 34 24Z" fill="#5C35A0"/>
      <path d="M28 22 Q42 10 54 14 Q46 20 40 26 Q44 28 48 32 Q38 28 34 24Z" stroke="#B39DDB" strokeWidth="1" fill="none"/>
      {/* lightning bolt on wing */}
      <path d="M12 16 L10 20 L13 20 L11 24" stroke="#FFEE58" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M44 16 L46 20 L43 20 L45 24" stroke="#FFEE58" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* body */}
      <ellipse cx="28" cy="38" rx="12" ry="14" fill="#4527A0"/>
      {/* scales */}
      <path d="M22 28 Q28 25 34 28" stroke="#7C4DFF" strokeWidth="1" fill="none" opacity=".7"/>
      <path d="M20 33 Q28 30 36 33" stroke="#7C4DFF" strokeWidth="1" fill="none" opacity=".6"/>
      <path d="M20 38 Q28 35 36 38" stroke="#7C4DFF" strokeWidth="1" fill="none" opacity=".5"/>
      {/* neck */}
      <path d="M26 24 Q28 18 30 14 Q32 18 30 24Z" fill="#4527A0"/>
      {/* head */}
      <ellipse cx="30" cy="12" rx="11" ry="9" fill="#5C35A0"/>
      {/* snout */}
      <path d="M34 12 Q42 12 44 15 Q42 18 34 17Z" fill="#4527A0"/>
      {/* electric eyes */}
      <circle cx="27" cy="10" r="3.5" fill="#FFEE58"/>
      <circle cx="27" cy="10" r="2" fill="#F9A825"/>
      <circle cx="27.7" cy="9.3" r=".8" fill="white"/>
      {/* horn */}
      <path d="M30 4 Q28 0 26 4 Q28 6 30 4Z" fill="#7C4DFF"/>
      <path d="M38 6 Q38 2 36 5 Q37 7 38 6Z" fill="#7C4DFF"/>
      {/* tail */}
      <path d="M20 50 Q12 54 8 50 Q10 46 18 48Z" fill="#4527A0"/>
      {/* claws */}
      <path d="M22 50 L20 54 M25 51 L24 55 M30 51 L30 55 M34 51 L36 54" stroke="#7C4DFF" strokeWidth="2" strokeLinecap="round"/>
      {/* electric aura */}
      <ellipse cx="30" cy="12" rx="13" ry="11" stroke="#7C4DFF" strokeWidth="1" fill="none" opacity=".3"/>
    </svg>
  )
}

// ── Lookup table: stage index → sprite component ──────────────────────────────
export const SPRITES = [
  SandCrab, SeaTurtle, Pelican,
  Bunny, Fox, Deer,
  Jellyfish, Dolphin, Shark,
  Penguin, ArcticFox, PolarBear,
  ThunderSerpent, StormDragon,
] as const

export type SpriteComponent = (typeof SPRITES)[number]
