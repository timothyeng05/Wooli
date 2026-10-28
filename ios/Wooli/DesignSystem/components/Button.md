# Button

Wooli's three button levels. Every action is Wooli blue; the accents are never button colours.

**Proposed:** a shared `WooliButtonStyle(.primary | .secondary | .tertiary)` in `Theme.swift`. Today the app mostly uses system `.borderedProminent` buttons tinted `Theme.brand`.

- **Primary:** a solid `brand` capsule with an `on-brand` label (5.2:1) and `shadow-button`. This is the main action on a screen (Add plan, Save, Connect bank), and there's only one per screen.
- **Secondary:** a `brand-soft` capsule with a `brand-dark` label (6.1:1). Use it for supporting actions (Review, Filter, Share).
- **Tertiary:** an outline at 35% brand with a `brand-dark` label. Use it for low-emphasis actions (Edit, Cancel).

All three use `callout` at 600 with `space-12` × `space-20` padding and `radius-full`. Lead an add action with a plus symbol.

**Consumer provides:** a label, a level, and optionally a leading SF Symbol.

- Do: put the primary button at the bottom of a sheet or right under the `TicketCard`.
- Don't: colour a button yellow, amber, teal or rose. Warm colours read as warnings, and those accents mark what something is, not what to do.
- Don't: use green or red buttons. Destructive actions use the system destructive role (red label) inside a confirmation.

Hand-written static web rendition (proposed).
