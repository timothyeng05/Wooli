# RangePicker

Equal-width capsule chips for a chart's time range: 1M, 3M, 6M, YTD, 1Y, All.

**SwiftUI:** `RangePicker(selection: $range)` bound to a `ChartRange`. Chips are `caption` at 600 weight with 6pt vertical padding and 4pt gaps. The selected chip has a `text` fill and a `card` label; the rest are `text-secondary` on clear. Selection changes with `.snappy` animation.

**Consumer provides:** a binding to the selected range.

- Do: place it directly under the chart it controls, full card width.
- Don't: use it for anything other than ranges; filters use menus.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
