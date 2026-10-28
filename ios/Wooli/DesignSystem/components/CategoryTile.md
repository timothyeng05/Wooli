# CategoryTile

A category's emoji on a rounded square tinted with the category colour at 14% opacity. Corners are `radius-s` and the emoji is 48% of the size.

**SwiftUI:** `CategoryTile(category:size:)`. Size defaults to 40. With no category it shows an SF Symbol `questionmark` in `text-tertiary`.

**Consumer provides:** a category (emoji `icon` and `colorHex`, in its group's colour (`group-*`). Every category in a group shares that tint and is told apart by its emoji) and optionally a size.

- Do: lead every transaction and category row with one at 40pt.
- Don't: replace the emoji with SF Symbols; emoji are how users name their own categories.

Hand-written static web rendition from `ios/Wooli/Wooli/Views/Theme.swift` (SwiftUI); not a live component.
