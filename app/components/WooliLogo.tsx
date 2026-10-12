export default function WooliLogo({ size = 36 }: { size?: number }) {
  const h = Math.round(size * 1.08)

  // Cloud body bump positions — front-facing sheep
  const bumps = [
    { cx: 50, cy: 60, r: 28 }, // main body
    { cx: 50, cy: 27, r: 17 }, // top centre
    { cx: 33, cy: 32, r: 15 }, // top left
    { cx: 67, cy: 32, r: 15 }, // top right
    { cx: 17, cy: 54, r: 13 }, // left side
    { cx: 83, cy: 54, r: 13 }, // right side
    { cx: 28, cy: 78, r: 14 }, // bottom left
    { cx: 72, cy: 78, r: 14 }, // bottom right
  ]
  const O = 4 // outline thickness

  return (
    <svg width={size} height={h} viewBox="0 0 100 108" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* ── Outline layer (dark blue, r + O) ── */}
      {bumps.map((b, i) => <circle key={i} cx={b.cx} cy={b.cy} r={b.r + O} fill="#1D3C5E"/>)}
      {/* Face outline */}
      <circle cx="50" cy="52" r="26" fill="#1D3C5E"/>
      {/* Leg outlines */}
      <rect x="26" y="88" width="12" height="17" rx="6" fill="#1D3C5E"/>
      <rect x="40" y="88" width="12" height="17" rx="6" fill="#1D3C5E"/>
      <rect x="54" y="88" width="12" height="17" rx="6" fill="#1D3C5E"/>
      <rect x="68" y="88" width="12" height="17" rx="6" fill="#1D3C5E"/>

      {/* ── White wool layer (r) ── */}
      {bumps.map((b, i) => <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="white"/>)}

      {/* ── Ears — drawn after wool so they show on top ── */}
      {/* Outline */}
      <ellipse cx="22" cy="36" rx="9" ry="13" fill="#1D3C5E"/>
      <ellipse cx="78" cy="36" rx="9" ry="13" fill="#1D3C5E"/>
      {/* Inner ear fill (slightly smaller, same dark blue — looks solid) */}
      <ellipse cx="22" cy="36" rx="6" ry="9" fill="#3e6182"/>
      <ellipse cx="78" cy="36" rx="6" ry="9" fill="#3e6182"/>

      {/* ── Face (dark blue) ── */}
      <circle cx="50" cy="52" r="22" fill="#1D3C5E"/>

      {/* ── Eyes ── */}
      <circle cx="41" cy="47" r="6" fill="white"/>
      <circle cx="59" cy="47" r="6" fill="white"/>
      <circle cx="41" cy="47" r="2.8" fill="#1D3C5E"/>
      <circle cx="59" cy="47" r="2.8" fill="#1D3C5E"/>
      {/* Eye highlights */}
      <circle cx="39.5" cy="45" r="1.2" fill="white"/>
      <circle cx="57.5" cy="45" r="1.2" fill="white"/>

      {/* ── Legs ── */}
      <rect x="28" y="89" width="10" height="15" rx="5" fill="#1D3C5E"/>
      <rect x="42" y="89" width="10" height="15" rx="5" fill="#1D3C5E"/>
      <rect x="56" y="89" width="10" height="15" rx="5" fill="#1D3C5E"/>
      <rect x="70" y="89" width="10" height="15" rx="5" fill="#1D3C5E"/>
    </svg>
  )
}
