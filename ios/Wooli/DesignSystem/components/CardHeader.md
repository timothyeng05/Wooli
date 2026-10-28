# CardHeader

A card's title row: `headline` title, optional `subheadline` subtitle in `text-secondary` 2pt below, and an optional trailing view aligned on the first baseline.

**SwiftUI:** `CardHeader(title:subtitle:) { trailing }`, or `CardHeader(title:subtitle:)` with no trailing view.

**Consumer provides:** the title; optionally a subtitle and a trailing view (a link, a `RangePicker`, a menu).

- Do: keep titles to one or two words ("Spending", "Accounts") and put the figure in the subtitle.
- Don't: put more than one control in the trailing slot.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
