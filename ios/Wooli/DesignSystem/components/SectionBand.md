# SectionBand

The Trips city header used for any collapsible section: a band washed in its section colour, with a glowing numbered or emoji badge, a bold title and a one-line summary.

**SwiftUI today:** `TripLegHeader` in `ios/Wooli/Wooli/Trips/TripLegViews.swift`. **Proposed:** a shared `SectionBand(title:summary:badge:tint:isNow:isCollapsed:)`, also used for budget category groups, Eats lists and recipe collections in place of a plain white `CardHeader`.

**Look:** the tint at 16% fading to 5% from left to right over `card`, a 1px tint hairline at 22%, `radius-l` and `space-16` padding. The 44pt badge is a tint gradient with a 35% tinted glow and a 19pt bold number in `on-tint` (white on blue, rose, violet and slate; `on-accent` ink on teal, pink and yellow), or an emoji. The title is `title3` at 700 in `text`, the summary `caption` in `text-secondary`, and the chevron is in the tint. "NOW" is a capsule in `text` with `card` letters.

**Consumer provides:** a title and summary, a badge (number or the group's emoji), and the group: travel, food, home, health, fun, shopping or money. The tint is always that group's colour, in every module. Trip cities are all `group-travel`; a section that isn't a group (Needs review) uses brand blue. In the web rendition, one `w-group-*` class sets both the tint and its on-tint.

- Do: keep all text in `text` or `text-secondary`. The tint is only for the wash, the badge and the chevron, so every colour stays legible.
- Do: say what a folded section still holds ("Folded · tap to show its days") so it doesn't read as empty.
- Don't: pick a colour by position, or give two groups the same colour. Don't put a SectionBand inside a Card.

Hand-written static web rendition, a proposed extension of `TripLegHeader`.
