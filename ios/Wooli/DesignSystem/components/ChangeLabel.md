# ChangeLabel

A change line such as "↗ $1,200.00 (4.2%)  1 month". The arrow, amount and optional percent are coloured `income` when the change is good and `expense` when it's bad, followed by an optional period in `text-secondary`.

**SwiftUI:** `ChangeLabel(change:base:period:invert:)`. `subheadline` at 500 weight with monospaced digits; arrows are SF Symbols `arrow.up.right` / `arrow.down.right` in bold. Set `invert: true` for debts, where going down is good.

**Consumer provides:** the change amount; optionally the base (to show a percent), a period label, and `invert`.

- Do: always show the arrow too, so the direction doesn't rely on colour alone.
- Don't: drop the sign or the arrow. On a TicketCard, set the whole line in `on-ticket`; the arrow carries the direction.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
