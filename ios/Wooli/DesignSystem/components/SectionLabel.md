# SectionLabel

The small uppercase eyebrow above a figure or group, like "NET WORTH".

**SwiftUI:** `SectionLabel("Net worth")`. Pass sentence case; it uppercases itself. Set in the `eyebrow` style (11pt bold, 1.1pt tracking), colour `text-tertiary`.

**Consumer provides:** the label text.

- Do: use one per card section, directly above the value it names.
- Don't: use it for sentences or anything someone must read to act. On a TicketCard, the same `eyebrow` style goes in `ticket-highlight`.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
