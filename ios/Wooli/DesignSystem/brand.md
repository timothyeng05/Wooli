# Wooli brand book

Wooli is a private iPhone app for the things people keep track of: their budget, their trips, the places they eat, the movies they watch and the recipes they cook. Everything stays on the phone and in the person's own iCloud. Wooli's look comes from its Trips module, and it's bright and youthful. Each module opens with its own travel object: a boarding pass for a trip, a road with a you-are-here pin for the month's budget, a passport of stamps for Eats, a cinema ticket for Movies and a departures board for what's next. Travel blue carries every action, and clean, saturated colours mark what kind of thing you're looking at (yellow for food, violet for home, teal for health and so on) the same way in every module, all on a pale sky-blue page. Colours sit as flat, solid blocks. Money keeps its own green and red, always with a sign and an arrow.

## Content fundamentals

- Write plainly, in the second person, and short. Real copy from the app: "You're looking at sample data. Connect your bank in Settings." · "You're all caught up" · "Every transaction has been reviewed." · "Try clearing some filters." · "$412.00 left to assign".
- Use sentence case for titles, buttons and rows ("Mark as reviewed", "Add just the start (recommended)"). Uppercase appears only in the `eyebrow` style (`SectionLabel` "NET WORTH", hero eyebrows "FROM" and "YOUR PASSPORT", stamp tiers, "ADMIT ONE", the "NOW" chip) and on the `DepartureBoard`.
- Name things for what they are: "Pending", "Uncategorized", "Needs review", "Split". No jokes, no exclamation marks.
- State privacy facts directly: "Stays on this iPhone and your iCloud." The App Store tagline is "Budget, trips & places to eat".
- Money is always formatted currency with monospaced digits; signed amounts show a + for income ("+$2,400.00").
- Emoji appear only as category icons (🏠 Home, 🛍️ Shopping, 📋 Bills & Other), chosen by the user. Never use them as decoration in copy.

## Colour

- **Blue leads.** `brand` (travel blue) is for everything you can act on: primary buttons, links, toggles, selected states, the needs-review dot, AI sparkles, the default `BarGauge` fill and the Loved stamp. `on-brand` sits on it. `brand-soft` with `brand-dark` is the secondary-button and tinted-panel pair.
- **Every overview opens with one hero object, matched to what the module is.** It sits on the `ticket-start` → `ticket-end` gradient with `on-ticket` text, which keeps a page from reading as bland, but the object changes by module (see "Travel motifs" below). The full-screen Review flow uses the same gradient.
- **Pages** are `background` (pale sky in light, the Trips globe's night ocean in dark). Content sits on `card` with a `border` hairline, and bars run on `track`. All neutrals lean navy; there is no plain gray. Text is `text` (navy ink), `text-secondary` and `text-tertiary`, all 4.5:1 or better on every ground in both themes.
- **Colour follows the group, not the position.** Every section, category, chart slice and plan belongs to one of seven groups, and takes that group's colour in every module:

  | Group | Token | Colour | Covers |
  |---|---|---|---|
  | Travel and getting around | `group-travel` | Blue | Trips and every city, flights, transit, gas and parking |
  | Food and drink | `group-food` | Yellow | Groceries, restaurants, coffee, Eats, Recipes, trip meals |
  | Home and bills | `group-home` | Violet | Rent, utilities, phone, insurance, trip stays |
  | Health and self | `group-health` | Teal | Pharmacy, gym, doctor, Period |
  | Fun and going out | `group-fun` | Rose | Movies, concerts, bars, trip activities |
  | Shopping and personal | `group-shopping` | Pink | Clothes, gifts, beauty |
  | Money moves | `group-money` | Slate | Income, savings, transfers, fees |

  - Items inside a group share its colour and are told apart by their emoji or symbol, never by a second hue.
  - A new budget group picks its colour by meaning ("What kind of spending is this?"), not the next one in line.
  - Trip cities are all `group-travel`, told apart by their number badge and name; the plans inside them carry their own groups (meals yellow, stays violet, activities rose).
  - Content on blue, rose, violet and slate is white. Content on teal, pink and yellow is `on-accent` navy ink. Yellow is a fill only: never a line, thin bar or small dot on white (1.5:1).
- **Amber is a signal, not a group:** bars near their limit and the Want to try chip's outline. Sections that aren't a group (Needs review, Next up) use brand blue.
- **Group colours are never buttons.** They say what something is, never "tap here". Bars near their limit turn amber; over it, `expense`.
- **Money colours stay on money.** `income` (green) and `expense` (red) only ever colour amounts, changes and the review badge, always with a sign and an arrow. Teal and rose are allowed as accents because they never appear on an amount. `pending` is amber text with the word "Pending", and its badge has a dashed outline so it reads differently from the amber accent. On a ticket, money lines are `on-ticket` and the arrow carries the direction.
- Spending-pace charts compare `this-month` (brand blue) against `last-month` (a quiet blue-gray).
- Eats and Movies rank with `RankStamp` in three inks: `brand` (Loved), `stamp-fine` (Fine, teal) and `text-tertiary` (Skip). Scores are never green or red. "Want to try" is a pale-yellow `ticket-highlight` chip.
- Full-screen travel views (transport detail, the globe) sit on `night`; the globe borrows `card`, `background` and `border` from the dark theme.

## Travel motifs

A motif is used only where it means something. Each screen gets at most one hero object; everything else is plain cards and rows.

| Motif | Means | Where |
|---|---|---|
| `TicketCard` (boarding pass) | A journey from A to B | Trips and transport only |
| `HeroCard` + RouteProgress | Time as a road, with you on it | The Budget month, savings goals, Period, trip countdowns |
| `HeroCard` + stamps | Places you've been | The Eats passport |
| `CinemaStub` | A film you saw | Movies only |
| `DepartureBoard` | Scheduled, with a status | Recurring bills, Today's "Next up" |
| `LuggageTag` | A label you attach | Categories, #tags, splits |
| `Postcard` | One place or memory | Eats notes, recipes "from" somewhere, trip summaries |
| `RankStamp` | Where something ranks for you | Eats and Movies rows |
| `SuitcaseSticker` | A milestone you've collected | Today and "Your stickers" |

- Notches mean "ticket", and only journeys get them. A budget is never a ticket.
- Keep motifs flat and in the system's colours; no photos, textures or skeuomorphic paper.

## Typography

- The app uses Apple's system font (SF Pro) through Dynamic Type, and this system mirrors those default (Large) sizes. Use the styles by role: `largeTitle` bold for overview titles, `title3` 700 for `SectionBand` titles, `headline` for card titles, `body` for row titles (500) and amounts (600), `subheadline` for meta lines, `footnote` for row subtitles, `callout` 600 for buttons, and `caption`/`caption2` for chips and badges.
- Wooli adds exactly four styles, and no others:
  - `amount` (32pt bold, tabular digits): the one big figure on a screen.
  - `display` (New York heavy, 34pt): detail titles for places, movies and recipes. Budget never uses it.
  - `code` (SF Rounded black, 28pt): airport codes and rank numbers.
  - `eyebrow` (11pt bold, 1.1pt tracking, uppercase): section labels, ticket eyebrows and stamp tiers.
- Never set a fixed point size. Every size comes from a style, so text grows with the person's Dynamic Type setting.
- No font files ship. These are platform faces, so off Apple platforms the stacks fall back to `system-ui` and Georgia.

## Spacing, radii, elevation

- **Spacing** has six steps:
  - `space-4`: title to subtitle, icon to label.
  - `space-8`: inside a row.
  - `space-12`: row padding and the gaps between cards.
  - `space-16`: screen margins, ticket and band padding, and the gaps between sections.
  - `space-20`: card padding.
  - `space-24`: around heroes and empty states.
- **Corners** have four sizes, continuous (squircle) on iOS:
  - `radius-s` (10): tiles, posters, inputs, inset panels.
  - `radius-m` (14): cards and form sections.
  - `radius-l` (22): `HeroCard`, `TicketCard`, `SectionBand`, sheets.
  - `radius-full`: buttons, chips, badges, bars, avatars.
- **Elevation:** cards get a navy-tinted `shadow-card` plus the hairline, tickets get a blue `shadow-ticket`, and primary buttons get `shadow-button`. Section badges and plan dots glow in their own tint at 35%.

## Components

- **Lists:** `ItemRow`, the one row for every module, and `EmptyState`.
- **Actions:** `Button` (primary blue, secondary soft blue, tertiary outline).
- **Heroes:** `HeroCard`, `TicketCard` (Trips only) and `CinemaStub` (Movies only).
- **Travel motifs:** `DepartureBoard`, `LuggageTag`, `Postcard` and `SuitcaseSticker`.
- **Sections:** `SectionBand` (section header) and `TimelineItem` (plan row).
- **Eats and Movies:** `RankStamp`, plus the face-off shown in the Eats screens.
- **From `Theme.swift`:** `Card`, `SectionLabel`, `CardHeader`, `PendingBadge`, `BarGauge`, `CategoryTile`, `RangePicker` and `ChangeLabel`.

Every screen uses one of three templates (Overview, Detail, Edit), described with module-by-module changes in "Screens and modules" and shown in the `Screens` previews. The component previews are static web renditions styled by `components/bundle.css` with `w-` class names. A `w-tint-*` class sets an accent and its matching on-colour together.

## Iconography

- Use SF Symbols for every control and status: `arrow.up.right`/`arrow.down.right` (change), `sparkles` (AI suggestion), `checkmark.square` (review), `line.3.horizontal` (menu), `arrow.clockwise` (sync), `exclamationmark.triangle.fill` (error), `building.columns` (bank), `arrow.triangle.branch` (split), `forward.fill` (rule applied).
- Category icons are emoji on a `CategoryTile`.
- The brand mark is the sheep (`assets/Logos/wooli-sheep.svg`), in `logo-outline` and `logo-inner` with white wool. The app icon puts it on a blue gradient.
- Bank logos (`assets/Institutions/`) appear only inside `InstitutionLogo`: a circle clip with a `border` ring at 40pt. An unknown bank gets its initial in SF Rounded bold on a 15% tint.

## Accessibility

Every text pair passes WCAG AA (4.5:1) in both themes; each token's note gives its ratios. These rules keep it that way:

| Rule | Why |
|---|---|
| `on-accent` ink, never white, on teal, amber, pink and yellow | White on them is only 1.5–3.7:1 |
| Yellow only as a fill with ink or a label on it | On white it is 1.5:1 |
| White, never ink, on blue, rose, violet and slate | Ink on them is only 3.0–3.6:1 |
| The ticket ends on `#2563eb`, not the code's `#3b82f6` | White text: 5.2:1 versus 3.7:1 |
| `last-month` chart lines are always labelled | A quiet comparison line, about 1.5–2:1 |
| Money changes always carry an arrow and a sign | Green and red alone fail for colour-blind readers, and teal and rose accents sit nearby |

## Proposed vs. the code today

This system is the design direction for Wooli, a step ahead of the app. Tokens marked "Proposed" give the value the code has now, so the change can be made in `Theme.swift`. The main moves are:

- Neutrals go from Tailwind gray to navy-tinted, and dark mode uses the Trips globe colours instead of `#0a0a0a`/`#171717`. The brand stays Tailwind blue `#2563eb`.
- Every overview gets a hero object matched to its module: the Trips ticket (`ticket-end` `#2563eb`, darkened `ticket-panel`) stays with Trips, and the other modules get `HeroCard`, `CinemaStub` or `DepartureBoard`. `SectionBand` and `TimelineItem` become shared views.
- Categories, city colours and plan kinds collapse from about 25 hues into seven group colours plus an amber signal. Lime, cyan, indigo, green, red and the duplicate violet are retired as category colours, and cities stop cycling colours.
- `income`, `expense`, `pending` and `text-tertiary` are darkened in light mode to pass contrast. The pending badge gains a dashed outline.
- Buttons get three levels (`Button`), all blue.
- Seven list rows become one `ItemRow`; the empty states become one `EmptyState`.
- Eats' Beli-style score ring becomes `RankStamp`, and its comparison becomes a face-off of ticket stubs.
- The scales shrink to 4 radii, 6 spacing steps and 4 extra type styles. See "Screens and modules" for the lint rules that enforce them.

Still not in this system:
- The website's palette in `app/globals.css`.
- Font files: the app uses Apple system faces.
- `InstitutionLogo` (its shape is the `ItemRow` logo slot), `ReviewButton`, `StatusBanner`, `SyncButton`, `HamburgerButton`.
