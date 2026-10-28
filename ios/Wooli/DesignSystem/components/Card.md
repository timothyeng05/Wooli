# Card

The white rounded surface every Wooli screen is built from: 20pt padding, `card` fill, `radius-m` continuous corners, a 1px `border` hairline and `shadow-card`.

**SwiftUI:** `.card()` or `.card(padding:)` (`CardModifier`). Put cards on `background` via `.pageBackground()`.

**Consumer provides:** the content; optionally a padding other than 20 (`space-20`). Cards stretch to full width, content leading-aligned.

- Do: start a card with a `CardHeader` or a `SectionLabel`; stack cards with 12–16pt gaps (`space-12`/`space-16`).
- Don't: nest cards, tint the card fill, or add stronger shadows; separation comes from the hairline.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
