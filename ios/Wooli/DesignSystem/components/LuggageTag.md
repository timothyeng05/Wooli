# LuggageTag

A label you attach to your stuff: a category, a #tag, or who a split is with. It's a tag with a punched hole, in the group's colour.

**Proposed:** `LuggageTag(_ title:, group:)`. It replaces the plain tag chips and the category picker pills.

**Look:** a 16% group wash over `card`, a 1.5pt edge in the group colour, a square left end with a punched hole (a `background`-coloured dot ringed in the tint), a rounded right end, and `footnote` 600 text in `text`.

**Consumer provides:** a title and its group. Free #tags use the group of the place or trip they belong to, or `group-money` for splits and people.

- Do: use tags in rows, filters, the category picker and transaction detail.
- Don't: make a tag a button for an action, or put two tags of the same group next to each other in different colours.

Hand-written static web rendition (proposed).
