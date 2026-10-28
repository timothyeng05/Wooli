# TimelineItem

A plan on a day: the time, a glowing circle in the plan's kind colour holding a white SF Symbol, then the title and place.

**SwiftUI today:** the day timeline rows in `ios/Wooli/Wooli/Trips/TripViews.swift`. **Proposed:** keep it in Trips, and reuse the same coloured circle for scheduled items elsewhere (recurring bills on a day, reservations in Eats).

**Look:** a 52pt right-aligned time column (`caption` 600, `text-secondary`, tabular digits). The circle is 30pt, a `kind-*` gradient with a 35% tinted glow, holding a symbol in `on-tint`: `kind-activity` (rose, fun) figure.walk, `kind-meal` (yellow, food) fork.knife, `kind-transit` (blue, travel) airplane, `kind-stay` (violet, home) bed.double.fill, `kind-note` (slate) note.text. Symbols are `on-accent` ink on yellow, and white on blue, rose, violet and slate. The title is `subheadline` 600 in `text`, the place `footnote` in `text-secondary`. An unfilled meal slot is a dashed ring at 60% of the tint on a 10% wash, labelled "Add dinner" in `text-secondary`.

**Consumer provides:** the kind, the title, and optionally a time and a place.

- Do: always pair the circle with its title, since the colour says the kind but the words carry it.
- Don't: use kind colours as text, or put white symbols on the light kinds (yellow takes `on-accent`).

Hand-written static web rendition; the symbols in the preview are web stand-ins for SF Symbols.
