# ItemRow

The one list row in Wooli: a 40pt leading slot, a title and subtitle, and a trailing slot. It replaces `TransactionRow`, `EatsPlaceRow`, `MovieRow`, `RecipeRow`, `TripItemRow`, `PlanRow` and `CategoryBudgetRow`, which all did this job slightly differently.

**Proposed:** `ItemRow(title:subtitle:leading:trailing:)` in `Theme.swift`, with a `belowText` slot for a `BarGauge`.

**Layout:** a 40pt leading slot, `space-12` to the text, and `space-12` vertical padding. The title is `body` at 500 in `text`, with an optional inline badge `space-8` after it. The subtitle is `footnote` in `text-tertiary`, using "·" between facts. The trailing slot is right-aligned. Rows inside a `Card` are separated by a `border` hairline that starts at the text, not the card edge.

**The only leading options:**
- `CategoryTile` for anything with a category: transactions, budget lines, recipes.
- An institution logo (circle) for accounts and payees.
- A 40×56 poster for movies.
- A small `RankStamp` for ranked places and movies.
- A `TimelineItem` kind dot, used inside a trip day.

**The only trailing options:**
- A money amount: `body` 600, tabular digits. `text` when spent, `income` with a + sign when received, `pending` when pending.
- A small `RankStamp`.
- The "Want to try" chip.
- A chevron, when the row only navigates.

**Consumer provides:** a title, a subtitle, one leading option, one trailing option, and optionally a bar.

- Do: put one fact per "·" segment in the subtitle. Keep the title to the thing's own name.
- Don't: add a second line of subtitle, or put buttons in a row. Use swipe actions and context menus.

Hand-written static web rendition (proposed).
