# PendingBadge

The quiet "Pending" capsule next to a transaction that hasn't posted yet.

**SwiftUI:** `PendingBadge()` (fixed text). `caption2` at 600 weight, 6×2pt padding, `pending` text (amber) on a `pending-soft` capsule (`radius-full`) with a 1px dashed outline at 45% of `pending`. Proposed: the dashed outline is new, so pending reads differently from the amber accent.

**Consumer provides:** nothing; place it after the title in a row.

- Do: pair it with the amount coloured `pending`, as `TransactionRow` does.
- Don't: reuse it for other states. On a TicketCard, show pending as text in `ticket-highlight` instead.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
