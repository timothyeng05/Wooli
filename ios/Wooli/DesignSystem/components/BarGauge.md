# BarGauge

A thin 8pt capsule progress bar: `track` behind, a tinted fill for value ÷ total, clamped to 0–100%.

**SwiftUI:** `BarGauge(value:total:tint:height:)`. Tint defaults to `brand` and height to 8. VoiceOver reads it as "N percent".

**Consumer provides:** `value` and `total`; optionally a `tint` (a category colour, `accent-amber` near a limit, `expense` over it) and a height.

- Do: put the numbers next to the bar in text; the bar only shows the proportion.
- Don't: use a gradient or stripes on the fill.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
