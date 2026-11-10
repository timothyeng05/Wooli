# RankStamp

Eats' own ranking mark: a tilted passport stamp showing a place's 1–10 score. It ties Eats to Trips, since every place you've eaten is a stamp in your passport.

**Replaces:** `MealScoreBadge`, a thin ring holding a 0–10 score coloured green, amber or red. That copied Beli and used the money colours.

**Look:** a double ring in the tier ink with a 3pt outer line, a 1pt inner line and a 3pt gap, tilted −8°, on `card`. Inside sit the tier in `eyebrow`, the score in `code` (SF Rounded black, one decimal; a perfect score prints "10"), and the neighbourhood or city in small caps. It's 92pt on a detail screen and 40pt in an `ItemRow`, where only the number shows.

**Tiers** use the same three feelings as the ranking flow, in new colours and words:
- **Loved:** `brand` ink.
- **Fine:** `stamp-fine` ink (deep teal in light, bright teal in dark).
- **Skip:** `text-tertiary` ink. The ranking flow still asks "Not for me?", but the stamp prints "Skip" so it fits the ring.

All three are 5.2:1 or better in both themes. The tier word is always printed, so colour never carries it alone.

**Score, not rank** (changed 2026-11-09 at the user's request): the number is the place's 1–10 score, since that's what people compare. Its position on the list ("#3 of 42") is the row's number and the "Your rating" line instead. A stamp given no score (the design-system previews) still prints a rank. Movies use the same stamp, with the release year in the small caps.

**Also in Eats:**
- **Want to try:** a pale-yellow `ticket-highlight` chip with `on-accent` text, never a stamp.
- **Which was better?** Shown as a `FaceOff` of two ticket stubs (see the Eats screens) rather than two plain buttons.

**Consumer provides:** the score (or a rank), the tier, and a place or year line.

- Do: show the 92pt stamp once, at the top of a place's detail screen beside its `display` title.
- Don't: show a decimal score anywhere, or tint stamps green or red.

Hand-written static web rendition (proposed).
