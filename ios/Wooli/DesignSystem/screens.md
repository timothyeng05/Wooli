# Screens and modules

Every module (Budget, Trips, Eats, Movies, Recipes and Period) is built from the same three screen templates and the same components. A module's identity comes from its content and its accent, not from inventing its own layout. The `Screens` previews show each template with real Wooli content.

## The three templates

**1. Overview:** the module's home tab.
1. Large title (`largeTitle` bold), with a blue + add button top right.
2. One hero object, the module's own (see the table below): the single most important number or the next thing coming up.
3. `SectionBand`s, each followed by a `Card` of `ItemRow`s or `TimelineItem`s.
4. `space-16` between blocks and `space-16` side margins on `background`.

It's never a stock iOS list on its own, and never more than one hero.

| Module | Hero |
|---|---|
| Today | A hero that switches between the next trip (`TicketCard`) and the month (`HeroCard`), a To do card only when something is waiting, Personal rings, a row of Explore tiles with real content, then the app grid |
| Budget | `HeroCard` with RouteProgress: "Left to spend" and the month as a road |
| Trips | `TicketCard`: the next leg |
| Eats | `HeroCard` passport: places, cities and the last few stamps |
| Movies | `CinemaStub`: your latest film, or "Your list" |
| Recipes | `HeroCard`: recipes saved and where they're from |
| Period | `HeroCard` with RouteProgress: day 12 of about 28 |

**2. Detail:** one thing (a place, a movie, a recipe, a transaction, a trip day).
1. An inline back button, then the title. Places, movies and recipes use `display` (New York heavy, one size). Money things use `amount`.
2. One meta line in `subheadline` / `text-secondary`, with "·" between facts.
3. One action row: one primary `Button`, and optionally one secondary.
4. `Card`s, each opening with a `SectionLabel`.

**3. Edit:** a sheet for adding or changing anything.
1. Cancel on the left and the title in the centre. No Save in the toolbar.
2. A segmented control if there's a mode (Spent / Received).
3. Grouped form sections in `card` with `radius-m`, labelled by small uppercase captions.
4. One full-width primary `Button` pinned at the bottom: "Add transaction", "Save changes".

**Empty:** an Overview with nothing in it keeps its hero and shows one `EmptyState` card below it.

## One way to do each thing

| Need | The one choice | Retired |
|---|---|---|
| A list row | `ItemRow` | 7 module-specific rows |
| A section header | `SectionBand` (with a colour) or `SectionLabel` (inside a card) | Plain list `Section` headers on overview screens |
| The screen's headline number | The module's hero + `amount` | 26–32pt numbers in white cards |
| Something scheduled | `DepartureBoard` | Plain lists of upcoming bills |
| A label | `LuggageTag` | Plain tag chips and category pills |
| A personal note | `Postcard` | Plain notes cards |
| A milestone | `SuitcaseSticker` | (new) |
| An action | `Button`: primary, secondary or tertiary | `.bordered`, `.borderedProminent`, coloured `.plain` buttons |
| Adding | A blue + in the top-right of the nav, plus "+ Add …" in empty states | "Add Account", "New trip", "Add" |
| Nothing yet | `EmptyState` | Mixed `ContentUnavailableView` and custom cards |
| A ranking | `RankStamp` | Decimal score rings |
| A colour for a thing | Its group colour (`group-travel`, `-food`, `-home`, `-health`, `-fun`, `-shopping`, `-money`) | Per-module palettes, cycling colours by position |
| Corners | `radius-s` · `radius-m` · `radius-l` · `radius-full` | 12 different radii |
| Spacing | `space-4` · `8` · `12` · `16` · `20` · `24` | About 20 padding values |
| Text | Dynamic Type styles, plus `amount`, `display`, `code` and `eyebrow` | About 18 fixed point sizes |

## Budget

Budget's carefully designed card dashboard stays, refocused:

- **One hero instead of two charts.** "Left to spend" becomes a `HeroCard` with RouteProgress: the month as a road from Oct 1 to Oct 31, with a pin at today and "$214 under your usual pace". `PaceCard` and `SpendingComparisonCard` both answered "how is this month going?"; merge them into the hero, and keep the full chart on the hero's detail screen.
- **Review gets a band.** "Needs review" is a blue `SectionBand` with the count as its badge, two `ItemRow`s showing their suggested category (✦), and a secondary "Review all" button.
- **Budget groups become bands.** Each group (Food & dining, Home & bills, …) is a `SectionBand` in its group colour, and its categories are `ItemRow`s with a `BarGauge` underneath. This replaces the Planned / Remaining table header, so each row reads as "$62 left".
- **Recurring bills become a `DepartureBoard`:** due date, name and amount, then PAID, DUE or LATE.
- **Categories and tags are `LuggageTag`s** in their group colour.
- **Customise stays.** The "Edit Home" ordering still applies, as long as the hero stays first.
- **Net worth moves** to the Accounts screen, where `RangePicker` and the chart already live.

## Trips

Trips set the standard; these changes make it the reference implementation:

- Take the 9 fixed font sizes down to `code` (airport codes), `amount` and Dynamic Type, and the 8 radii down to the four.
- The ticket keeps its gradient, route, notches and dashed lines, ending on `#2563eb` with a darkened panel so white text passes. The planned next leg is always the hero.
- City headers are `SectionBand`s, all `group-travel` blue, told apart by their number badge and name. Plans are `TimelineItem`s in their own group colours: meals yellow, stays violet, activities rose.
- **Cross-module:** saved Eats places in a trip's city appear under that city as one `ItemRow` with the "Want to try" chip.
- Keep frosted-glass chips only on top of maps; they're the one place a material belongs.

## Eats: made Wooli's own

Eats copied Beli's look (a 0–10 score in a green, amber or red ring). The ranking mechanic, "which was better?", is a good one and stays. The presentation becomes Wooli's:

- **A passport, not a scoreboard.** The hero is a `HeroCard` passport ("Your passport · 42 places · 8 cities", with the last few stamps). Each place gets a `RankStamp`, a tilted passport stamp with its rank on your list and its neighbourhood, so Eats and Trips share one travel story.
- **Rank, not score.** "#3", meaning third on your list, replaces "8.7". There are no decimals and no green or red, which also keeps those colours for money.
- **Tiers in Wooli's words and colours:** Loved (blue), Fine (teal), Skip (slate).
- **The face-off.** "Which was better?" shows two ticket stubs side by side. Tap the better one, and it gets a blue ring. A step count ("Step 2 of about 5") shows how close you are to placing it.
- **Want to try** is a pale-yellow chip, and it surfaces inside Trips when you're headed to that city.
- **Your notes are a `Postcard`** with the place's emoji in the stamp box.
- **Visits** are `ItemRow`s with who you went with and what you ordered. They're the place's history, not a feed.

## Movies, Recipes and Period

Today these are stock iOS lists. They move onto the templates with no new components:

- **Movies:** Overview with a `CinemaStub` hero (your latest film, or "Your list"), `ItemRow`s with posters and small stamps, and the same face-off.
- **Recipes:** Overview with `ItemRow`s (CategoryTile, "20 min · 4 ingredients"). The detail screen has a `display` title, `LuggageTag`s, a `Postcard` saying where the recipe is from, and ingredient and step cards.
- **Period:** Overview with a `HeroCard` and RouteProgress ("Day 12 · next in about 16 days") and a private-mode note.
- **Today:** a hero that switches between the next trip (`TicketCard`) and the month (`HeroCard`), a To do card only when something is waiting, Personal rings, a row of Explore tiles with real content, then the app grid.

## Enforcing it in code

Proposed for the repository, so drift can't come back:

- A `Theme` API that exposes only the allowed scales, for example `Radius.card`, `Space.m` and `.wooliFont(.amount)`.
- SwiftLint custom rules, run in CI, that fail on a numeric `cornerRadius:`, `.font(.system(size:`, `Color(hex:` or `.padding(<number>)` anywhere outside `Theme.swift`.
- The shared components (`ItemRow`, `HeroCard`, `TicketCard`, `SectionBand`, `EmptyState`, `RankStamp`, `DepartureBoard`, `LuggageTag`, `Postcard`, `CinemaStub`, `SuitcaseSticker` and `WooliButtonStyle`) live in `Theme.swift` or `Shared/`, never inside a module folder.
