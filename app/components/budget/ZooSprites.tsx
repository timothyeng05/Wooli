// SVG pig + house sprites for WooliBudget Zoo
// All pigs face RIGHT by default; pigFace animation flips scaleX for leftward travel.

type SP = { size?: number }

// ── Pig forms (balance thresholds: 0 / 5K / 50K / 500K / 5M) ────────────────

export function PigTiny({ size = 56 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 80 56" fill="none">
      <path d="M9 35 Q3 26 11 21 Q19 16 15 27" stroke="#fda4af" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="26" cy="37" rx="14" ry="11" fill="#ffb7c5"/>
      <ellipse cx="28" cy="40" rx="10" ry="7" fill="#fff1f2" opacity=".6"/>
      <ellipse cx="58" cy="25" rx="20" ry="18" fill="#ffb7c5"/>
      <ellipse cx="68" cy="32" rx="7" ry="4" fill="#fb7185" opacity=".35"/>
      <ellipse cx="50" cy="9" rx="8" ry="6" fill="#fda4af" transform="rotate(-18 50 9)"/>
      <ellipse cx="50" cy="10" rx="5" ry="4" fill="#f9a8d4" transform="rotate(-18 50 10)"/>
      <ellipse cx="66" cy="7" rx="8" ry="7" fill="#fda4af" transform="rotate(14 66 7)"/>
      <ellipse cx="66" cy="8" rx="5" ry="4" fill="#f9a8d4" transform="rotate(14 66 8)"/>
      <circle cx="66" cy="22" r="4" fill="white"/>
      <circle cx="67" cy="22" r="2.5" fill="#1a1a1a"/>
      <circle cx="67.5" cy="21" r="1" fill="white"/>
      <ellipse cx="77" cy="30" rx="7" ry="6" fill="#fda4af"/>
      <circle cx="74" cy="31" r="1.8" fill="#be8a9a"/>
      <circle cx="79" cy="31" r="1.8" fill="#be8a9a"/>
      <path d="M71 34 Q74 37 77 34" stroke="#be123c" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <rect x="15" y="44" width="7" height="10" rx="3.5" fill="#fda4af"/>
      <rect x="25" y="44" width="7" height="10" rx="3.5" fill="#fda4af"/>
      <rect x="36" y="46" width="6" height="8" rx="3" fill="#ffb7c5"/>
      <rect x="44" y="46" width="6" height="8" rx="3" fill="#ffb7c5"/>
    </svg>
  )
}

export function PigSm({ size = 56 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 80 56" fill="none">
      <path d="M8 33 Q3 24 11 20 Q19 16 14 26" stroke="#fda4af" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="28" cy="36" rx="18" ry="14" fill="#ffb7c5"/>
      <ellipse cx="30" cy="40" rx="13" ry="9" fill="#fff1f2" opacity=".6"/>
      <ellipse cx="58" cy="25" rx="18" ry="16" fill="#ffb7c5"/>
      <ellipse cx="66" cy="31" rx="6" ry="4" fill="#fb7185" opacity=".35"/>
      <ellipse cx="50" cy="10" rx="8" ry="7" fill="#fda4af" transform="rotate(-15 50 10)"/>
      <ellipse cx="50" cy="11" rx="5" ry="4" fill="#f9a8d4" transform="rotate(-15 50 11)"/>
      <ellipse cx="65" cy="8" rx="8" ry="7" fill="#fda4af" transform="rotate(12 65 8)"/>
      <ellipse cx="65" cy="9" rx="5" ry="4" fill="#f9a8d4" transform="rotate(12 65 9)"/>
      <circle cx="64" cy="22" r="3.5" fill="white"/>
      <circle cx="65" cy="22" r="2.2" fill="#1a1a1a"/>
      <circle cx="65.5" cy="21" r=".9" fill="white"/>
      <ellipse cx="75" cy="29" rx="7" ry="6" fill="#fda4af"/>
      <circle cx="72" cy="30" r="1.8" fill="#be8a9a"/>
      <circle cx="78" cy="30" r="1.8" fill="#be8a9a"/>
      <path d="M69 33 Q72 36 75 33" stroke="#be123c" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <rect x="14" y="45" width="8" height="10" rx="4" fill="#fda4af"/>
      <rect x="25" y="45" width="8" height="10" rx="4" fill="#fda4af"/>
      <rect x="36" y="46" width="7" height="9" rx="3" fill="#ffb7c5"/>
      <rect x="46" y="46" width="7" height="9" rx="3" fill="#ffb7c5"/>
    </svg>
  )
}

export function PigMd({ size = 56 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 80 56" fill="none">
      <path d="M6 32 Q1 22 9 18 Q17 14 13 25" stroke="#fda4af" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="30" cy="35" rx="22" ry="17" fill="#ffb7c5"/>
      <ellipse cx="32" cy="40" rx="16" ry="11" fill="#fff1f2" opacity=".65"/>
      <ellipse cx="60" cy="24" rx="18" ry="16" fill="#ffb7c5"/>
      <ellipse cx="68" cy="30" rx="7" ry="5" fill="#fb7185" opacity=".4"/>
      <ellipse cx="52" cy="9" rx="8" ry="7" fill="#fda4af" transform="rotate(-14 52 9)"/>
      <ellipse cx="52" cy="10" rx="5" ry="4" fill="#f9a8d4" transform="rotate(-14 52 10)"/>
      <ellipse cx="67" cy="8" rx="8" ry="7" fill="#fda4af" transform="rotate(12 67 8)"/>
      <ellipse cx="67" cy="9" rx="5" ry="4" fill="#f9a8d4" transform="rotate(12 67 9)"/>
      <circle cx="65" cy="21" r="3.5" fill="white"/>
      <circle cx="66" cy="21" r="2.2" fill="#1a1a1a"/>
      <circle cx="66.5" cy="20" r=".9" fill="white"/>
      <ellipse cx="76" cy="29" rx="7.5" ry="6.5" fill="#fda4af"/>
      <circle cx="73" cy="30" r="2" fill="#be8a9a"/>
      <circle cx="79" cy="30" r="2" fill="#be8a9a"/>
      <path d="M69 33 Q73 37 77 33" stroke="#be123c" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <rect x="13" y="46" width="8" height="9" rx="4" fill="#fda4af"/>
      <rect x="24" y="46" width="8" height="9" rx="4" fill="#fda4af"/>
      <rect x="38" y="47" width="8" height="8" rx="4" fill="#ffb7c5"/>
      <rect x="49" y="47" width="8" height="8" rx="4" fill="#ffb7c5"/>
    </svg>
  )
}

export function PigLg({ size = 56 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 84 60" fill="none">
      <path d="M7 35 Q2 24 10 20 Q18 16 14 27" stroke="#fda4af" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="32" cy="36" rx="26" ry="21" fill="#ffb7c5"/>
      <ellipse cx="34" cy="42" rx="19" ry="14" fill="#fff1f2" opacity=".65"/>
      <path d="M8 32 Q32 26 56 32" stroke="#fda4af" strokeWidth="2" fill="none" opacity=".5"/>
      <ellipse cx="64" cy="24" rx="18" ry="16" fill="#ffb7c5"/>
      <ellipse cx="72" cy="31" rx="8" ry="5.5" fill="#fb7185" opacity=".45"/>
      <ellipse cx="54" cy="29" rx="6" ry="4" fill="#fb7185" opacity=".3"/>
      <ellipse cx="56" cy="9" rx="9" ry="7" fill="#fda4af" transform="rotate(-14 56 9)"/>
      <ellipse cx="56" cy="10" rx="6" ry="4" fill="#f9a8d4" transform="rotate(-14 56 10)"/>
      <ellipse cx="72" cy="8" rx="9" ry="8" fill="#fda4af" transform="rotate(12 72 8)"/>
      <ellipse cx="72" cy="9" rx="6" ry="5" fill="#f9a8d4" transform="rotate(12 72 9)"/>
      <circle cx="69" cy="21" r="4" fill="white"/>
      <circle cx="70" cy="21" r="2.5" fill="#1a1a1a"/>
      <circle cx="70.5" cy="20" r="1" fill="white"/>
      <ellipse cx="80" cy="30" rx="8" ry="7" fill="#fda4af"/>
      <circle cx="77" cy="31" r="2.2" fill="#be8a9a"/>
      <circle cx="83" cy="31" r="2.2" fill="#be8a9a"/>
      <path d="M73 35 Q77 40 81 35" stroke="#be123c" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <rect x="14" y="51" width="9" height="8" rx="4" fill="#fda4af"/>
      <rect x="26" y="51" width="9" height="8" rx="4" fill="#fda4af"/>
      <rect x="42" y="52" width="8" height="7" rx="3" fill="#ffb7c5"/>
      <rect x="54" y="52" width="8" height="7" rx="3" fill="#ffb7c5"/>
    </svg>
  )
}

export function PigRoyal({ size = 56 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 84 67" fill="none">
      <path d="M7 40 Q2 29 10 25 Q18 21 14 32" stroke="#fda4af" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="32" cy="42" rx="26" ry="21" fill="#ffb7c5"/>
      <ellipse cx="34" cy="48" rx="19" ry="14" fill="#fff1f2" opacity=".65"/>
      <path d="M8 38 Q32 32 56 38" stroke="#fda4af" strokeWidth="2" fill="none" opacity=".5"/>
      <ellipse cx="64" cy="30" rx="18" ry="16" fill="#ffb7c5"/>
      <ellipse cx="72" cy="37" rx="8" ry="5.5" fill="#fb7185" opacity=".45"/>
      <ellipse cx="54" cy="35" rx="6" ry="4" fill="#fb7185" opacity=".3"/>
      <ellipse cx="56" cy="15" rx="9" ry="7" fill="#fda4af" transform="rotate(-14 56 15)"/>
      <ellipse cx="56" cy="16" rx="6" ry="4" fill="#f9a8d4" transform="rotate(-14 56 16)"/>
      <ellipse cx="72" cy="14" rx="9" ry="8" fill="#fda4af" transform="rotate(12 72 14)"/>
      <ellipse cx="72" cy="15" rx="6" ry="5" fill="#f9a8d4" transform="rotate(12 72 15)"/>
      {/* Golden crown */}
      <polygon points="52,16 56,6 61,14 66,4 71,14 76,6 80,16" fill="#fbbf24"/>
      <rect x="52" y="14" width="28" height="5" rx="1" fill="#f59e0b"/>
      <circle cx="61" cy="12" r="2.5" fill="#dc2626"/>
      <circle cx="71" cy="11" r="2" fill="#2563eb"/>
      <circle cx="66" cy="7" r="2" fill="#16a34a"/>
      <circle cx="69" cy="27" r="4" fill="white"/>
      <circle cx="70" cy="27" r="2.5" fill="#1a1a1a"/>
      <circle cx="70.5" cy="26" r="1" fill="white"/>
      <ellipse cx="80" cy="36" rx="8" ry="7" fill="#fda4af"/>
      <circle cx="77" cy="37" r="2.2" fill="#be8a9a"/>
      <circle cx="83" cy="37" r="2.2" fill="#be8a9a"/>
      <path d="M73 41 Q77 46 81 41" stroke="#be123c" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <rect x="14" y="57" width="9" height="8" rx="4" fill="#fda4af"/>
      <rect x="26" y="57" width="9" height="8" rx="4" fill="#fda4af"/>
      <rect x="42" y="58" width="8" height="7" rx="3" fill="#ffb7c5"/>
      <rect x="54" y="58" width="8" height="7" rx="3" fill="#ffb7c5"/>
    </svg>
  )
}

export const PIG_SPRITES = [PigTiny, PigSm, PigMd, PigLg, PigRoyal] as const

// ── House forms (balance thresholds: 0 / 5K / 50K / 500K) ───────────────────

export function HouseBurrow({ size = 80 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.65)} viewBox="0 0 100 65" fill="none">
      <ellipse cx="50" cy="55" rx="48" ry="30" fill="#7c5c3a"/>
      <ellipse cx="44" cy="42" rx="28" ry="14" fill="#a07850" opacity=".5"/>
      <ellipse cx="50" cy="62" rx="13" ry="16" fill="#2c1a0a"/>
      <ellipse cx="50" cy="64" rx="10" ry="13" fill="#1a0f07"/>
      <path d="M28 32 Q26 24 28 20 Q30 24 32 20 Q34 24 36 20 Q37 24 36 32" fill="#2d6b2d" opacity=".8"/>
      <path d="M60 28 Q58 20 60 16 Q62 20 64 16 Q65 20 64 28" fill="#2d6b2d" opacity=".7"/>
      <path d="M44 26 Q42 19 44 15 Q46 19 48 15 Q49 19 48 26" fill="#166534" opacity=".7"/>
    </svg>
  )
}

export function HouseHut({ size = 80 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.88)} viewBox="0 0 100 88" fill="none">
      <rect x="15" y="48" width="70" height="38" rx="2" fill="#8B6345"/>
      <line x1="15" y1="58" x2="85" y2="58" stroke="#7c5a38" strokeWidth="1" opacity=".6"/>
      <line x1="15" y1="68" x2="85" y2="68" stroke="#7c5a38" strokeWidth="1" opacity=".6"/>
      <line x1="15" y1="78" x2="85" y2="78" stroke="#7c5a38" strokeWidth="1" opacity=".6"/>
      <polygon points="10,48 50,12 90,48" fill="#5c3a1e"/>
      <rect x="20" y="55" width="20" height="18" rx="2" fill="#bfdbfe" opacity=".8"/>
      <line x1="30" y1="55" x2="30" y2="73" stroke="#5c3a1e" strokeWidth="1.5"/>
      <line x1="20" y1="64" x2="40" y2="64" stroke="#5c3a1e" strokeWidth="1.5"/>
      <rect x="58" y="62" width="22" height="24" rx="3" fill="#3b1f0a"/>
      <circle cx="76" cy="75" r="2.5" fill="#ca8a04"/>
      <ellipse cx="50" cy="87" rx="38" ry="4" fill="#000" opacity=".15"/>
    </svg>
  )
}

export function HouseBrick({ size = 80 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.94)} viewBox="0 0 110 95" fill="none">
      <rect x="72" y="10" width="13" height="28" rx="1" fill="#a05a38"/>
      <rect x="70" y="8" width="17" height="5" rx="1" fill="#7c3a1e"/>
      <rect x="10" y="48" width="90" height="44" rx="2" fill="#c2856f"/>
      <line x1="10" y1="56" x2="100" y2="56" stroke="#a06050" strokeWidth="1" opacity=".7"/>
      <line x1="10" y1="64" x2="100" y2="64" stroke="#a06050" strokeWidth="1" opacity=".7"/>
      <line x1="10" y1="72" x2="100" y2="72" stroke="#a06050" strokeWidth="1" opacity=".7"/>
      <line x1="10" y1="80" x2="100" y2="80" stroke="#a06050" strokeWidth="1" opacity=".7"/>
      <polygon points="6,48 55,10 104,48" fill="#7c2d0a"/>
      <rect x="18" y="56" width="24" height="20" rx="2" fill="#bfdbfe" opacity=".85"/>
      <rect x="18" y="56" width="24" height="20" rx="2" stroke="#7c3a1e" strokeWidth="1.5" fill="none"/>
      <line x1="30" y1="56" x2="30" y2="76" stroke="#7c3a1e" strokeWidth="1.5"/>
      <line x1="18" y1="66" x2="42" y2="66" stroke="#7c3a1e" strokeWidth="1.5"/>
      <rect x="68" y="56" width="24" height="20" rx="2" fill="#bfdbfe" opacity=".85"/>
      <rect x="68" y="56" width="24" height="20" rx="2" stroke="#7c3a1e" strokeWidth="1.5" fill="none"/>
      <line x1="80" y1="56" x2="80" y2="76" stroke="#7c3a1e" strokeWidth="1.5"/>
      <line x1="68" y1="66" x2="92" y2="66" stroke="#7c3a1e" strokeWidth="1.5"/>
      <rect x="43" y="65" width="24" height="27" rx="3" fill="#5c3a1e"/>
      <path d="M43 68 Q55 58 67 68" fill="#4a2e16"/>
      <circle cx="63" cy="79" r="2.5" fill="#ca8a04"/>
      <rect x="38" y="90" width="34" height="5" rx="1" fill="#d4a07a"/>
      <ellipse cx="55" cy="94" rx="44" ry="3.5" fill="#000" opacity=".12"/>
    </svg>
  )
}

export function HouseMansion({ size = 80 }: SP) {
  return (
    <svg width={size} height={Math.round(size * 0.86)} viewBox="0 0 140 110" fill="none">
      <rect x="2"   y="54" width="30"  height="52" rx="1" fill="#e8d5c4"/>
      <rect x="108" y="54" width="30"  height="52" rx="1" fill="#e8d5c4"/>
      <rect x="18"  y="44" width="104" height="62" rx="1" fill="#f0e6d8"/>
      <polygon points="14,44 70,6 126,44" fill="#7c3a1e"/>
      <polygon points="2,54 17,44 32,54"    fill="#8B4513"/>
      <polygon points="108,54 123,44 138,54" fill="#8B4513"/>
      <rect x="30"  y="60" width="6" height="46" rx="2" fill="#d4b89a"/>
      <rect x="44"  y="60" width="6" height="46" rx="2" fill="#d4b89a"/>
      <rect x="90"  y="60" width="6" height="46" rx="2" fill="#d4b89a"/>
      <rect x="104" y="60" width="6" height="46" rx="2" fill="#d4b89a"/>
      <rect x="28"  y="58" width="10" height="4" rx="1" fill="#c4a882"/>
      <rect x="42"  y="58" width="10" height="4" rx="1" fill="#c4a882"/>
      <rect x="88"  y="58" width="10" height="4" rx="1" fill="#c4a882"/>
      <rect x="102" y="58" width="10" height="4" rx="1" fill="#c4a882"/>
      <rect x="24" y="50" width="20" height="16" rx="2" fill="#bfdbfe" opacity=".8"/>
      <line x1="34" y1="50" x2="34" y2="66" stroke="#7c3a1e" strokeWidth="1"/>
      <line x1="24" y1="58" x2="44" y2="58" stroke="#7c3a1e" strokeWidth="1"/>
      <rect x="96" y="50" width="20" height="16" rx="2" fill="#bfdbfe" opacity=".8"/>
      <line x1="106" y1="50" x2="106" y2="66" stroke="#7c3a1e" strokeWidth="1"/>
      <line x1="96"  y1="58" x2="116" y2="58" stroke="#7c3a1e" strokeWidth="1"/>
      <rect x="24" y="72" width="22" height="18" rx="2" fill="#bfdbfe" opacity=".8"/>
      <line x1="35" y1="72" x2="35" y2="90" stroke="#7c3a1e" strokeWidth="1"/>
      <rect x="94" y="72" width="22" height="18" rx="2" fill="#bfdbfe" opacity=".8"/>
      <line x1="105" y1="72" x2="105" y2="90" stroke="#7c3a1e" strokeWidth="1"/>
      <rect x="57" y="68" width="26" height="38" rx="4" fill="#5c3a1e"/>
      <path d="M57 72 Q70 58 83 72" fill="#4a2e16"/>
      <rect x="61" y="74" width="8"  height="10" rx="1" fill="#4a2e16" opacity=".6"/>
      <rect x="71" y="74" width="8"  height="10" rx="1" fill="#4a2e16" opacity=".6"/>
      <rect x="61" y="88" width="8"  height="10" rx="1" fill="#4a2e16" opacity=".6"/>
      <rect x="71" y="88" width="8"  height="10" rx="1" fill="#4a2e16" opacity=".6"/>
      <circle cx="71" cy="86" r="2.5" fill="#ca8a04"/>
      <rect x="50" y="106" width="40" height="4" rx="1" fill="#d4b89a"/>
      <rect x="54" y="103" width="32" height="3" rx="1" fill="#c8aa8a"/>
      <ellipse cx="70" cy="109" rx="58" ry="3" fill="#000" opacity=".1"/>
    </svg>
  )
}

export const HOUSE_SPRITES = [HouseBurrow, HouseHut, HouseBrick, HouseMansion] as const
