# Building the Wooli design system in SwiftUI

This is the build plan for moving the iPhone app onto the design system in this folder. It's written for Claude Code (or any agent) working from `ios/Wooli/BACKLOG.md`, Phase D. Do the steps in order; each one ships on its own and leaves the app working.

**Before every step, read:** `README.md` here, the step's component files in `components/`, and the matching PNGs in `reference/`. The PNGs are the visual target, in light and dark.

**Rules that hold for every step**
- Follow the backlog's collaboration rules: claim the item, one item per commit (prefix `iOS: D<n>`), build before committing, then log it in Done.
- Build: `cd ios/Wooli && xcodebuild -scheme Wooli -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build`. No new warnings.
- Check UI in the Simulator with the `-sampleData` launch argument, in light **and** dark mode, against `reference/`.
- Use only `Theme` values. No `Color(hex:)`, no numeric `cornerRadius:` and no `.font(.system(size:))` outside `Theme.swift` and `Shared/DesignSystem/`.
- Don't change data models or behaviour in a design step. If a step seems to need it, stop and add it to the backlog Inbox.
- Shared views go in `ios/Wooli/Wooli/Shared/DesignSystem/`, one file per component, each with a `#Preview` showing light and dark.

---

## D1 · Tokens in `Theme.swift`

**Change:** replace the values in `Views/Theme.swift` with the tokens below, and add the scales. Keep the existing property names (`brand`, `card`, `text`, `income` and so on) so no other file has to change in this step. Add the new names alongside them.

```swift
enum Space { static let xs: CGFloat = 4, s: CGFloat = 8, m: CGFloat = 12, l: CGFloat = 16, xl: CGFloat = 20, xxl: CGFloat = 24 }
enum Radius { static let small: CGFloat = 10, card: CGFloat = 14, hero: CGFloat = 22 }   // "full" = Capsule() / Circle()

extension Theme {
    enum Group: String, CaseIterable {
        case travel, food, home, health, fun, shopping, money
        var color: Color   // see the table
        var onColor: Color // white for travel, home, fun, money; Theme.onAccent for food, health, shopping
    }
}

enum WooliFont { case amount, display, code, eyebrow }
// .wooliFont(.amount): 32pt bold, monospacedDigit, scaled with @ScaledMetric(relativeTo: .largeTitle)
// .wooliFont(.display): 34pt .serif .heavy, scaled relativeTo: .largeTitle
// .wooliFont(.code): 28pt .rounded .black, scaled relativeTo: .title
// .wooliFont(.eyebrow): 11pt bold, tracking 1.1, uppercased, scaled relativeTo: .caption2
```

Shadows: `cardShadow` = black·(light 0.06 navy / dark 0.3), radius 2, y 1. `ticketShadow` = brand at 30%, radius 10, y 5. `buttonShadow` = brand at 30%, radius 4, y 2.

**Colour tokens** (light / dark, resolved; "=" means it's an alias and should be written as one in Swift):

| Token | Swift | Light | Dark | |
|---|---|---|---|---|
| `brand` | `Theme.brand` | `#2563eb` | `#60a5fa` |  |
| `brand-dark` | `Theme.brandDark` | `#1d4ed8` | `#93c5fd` |  |
| `brand-soft` | `Theme.brandSoft` | `#f0f5ff` | `#1b2f5c` |  |
| `on-brand` | `Theme.onBrand` | `#ffffff` | `#0f1b33` |  |
| `background` | `Theme.background` | `#eef3fa` | `#070d1c` |  |
| `card` | `Theme.card` | `#ffffff` | `#13213d` |  |
| `border` | `Theme.border` | `#d8e2f0` | `#22314f` |  |
| `track` | `Theme.track` | `#e3eaf5` | `#1d2b4a` |  |
| `text` | `Theme.text` | `#0f1b33` | `#eef2fa` |  |
| `text-secondary` | `Theme.textSecondary` | `#475877` | `#b3c0d9` |  |
| `text-tertiary` | `Theme.textTertiary` | `#5f6f8e` | `#8d9bba` |  |
| `income` | `Theme.income` | `#15803d` | `#4ade80` |  |
| `expense` | `Theme.expense` | `#b91c1c` | `#f87171` |  |
| `pending` | `Theme.pending` | `#b45309` | `#fbbf24` |  |
| `pending-soft` | `Theme.pendingSoft` | `#fff4dc` | `#3a2606` |  |
| `last-month` | `Theme.lastMonth` | `#c7d2e3` | `#3a4c72` |  |
| `this-month` | `Theme.thisMonth` | `#2563eb` | `#60a5fa` | = `brand` |
| `ticket-start` | `Theme.ticketStart` | `#1e3a8a` | `#1e3a8a` |  |
| `ticket-end` | `Theme.ticketEnd` | `#2563eb` | `#2563eb` |  |
| `on-ticket` | `Theme.onTicket` | `#ffffff` | `#ffffff` |  |
| `ticket-panel` | `Theme.ticketPanel` | `rgba(15, 27, 51, 0.16)` | `rgba(15, 27, 51, 0.16)` |  |
| `ticket-rule` | `Theme.ticketRule` | `rgba(255, 255, 255, 0.4)` | `rgba(255, 255, 255, 0.4)` |  |
| `ticket-highlight` | `Theme.ticketHighlight` | `#fef3c7` | `#fef3c7` |  |
| `night` | `Theme.night` | `#050812` | `#050812` |  |
| `board` | `Theme.board` | `#0f1b33` | `#0f1b33` |  |
| `board-cell` | `Theme.boardCell` | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.08)` |  |
| `on-board` | `Theme.onBoard` | `#fef3c7` | `#fef3c7` | = `ticket-highlight` |
| `board-muted` | `Theme.boardMuted` | `#b3c0d9` | `#b3c0d9` |  |
| `board-late` | `Theme.boardLate` | `#f87171` | `#f87171` |  |
| `stamp-fine` | `Theme.stampFine` | `#0f766e` | `#2dd4bf` |  |
| `on-accent` | `Theme.onAccent` | `#0f1b33` | `#0f1b33` |  |
| `accent-blue` | `Theme.accentBlue` | `#2563eb` | `#2563eb` |  |
| `accent-teal` | `Theme.accentTeal` | `#0d9488` | `#0d9488` |  |
| `accent-rose` | `Theme.accentRose` | `#e11d48` | `#e11d48` |  |
| `accent-violet` | `Theme.accentViolet` | `#7c3aed` | `#7c3aed` |  |
| `accent-amber` | `Theme.accentAmber` | `#d97706` | `#d97706` |  |
| `accent-pink` | `Theme.accentPink` | `#ec4899` | `#ec4899` |  |
| `accent-yellow` | `Theme.accentYellow` | `#facc15` | `#facc15` |  |
| `accent-slate` | `Theme.accentSlate` | `#64748b` | `#64748b` |  |
| `group-travel` | `Theme.Group.travel.color` | `#2563eb` | `#2563eb` | = `accent-blue` |
| `group-food` | `Theme.Group.food.color` | `#facc15` | `#facc15` | = `accent-yellow` |
| `group-home` | `Theme.Group.home.color` | `#7c3aed` | `#7c3aed` | = `accent-violet` |
| `group-health` | `Theme.Group.health.color` | `#0d9488` | `#0d9488` | = `accent-teal` |
| `group-fun` | `Theme.Group.fun.color` | `#e11d48` | `#e11d48` | = `accent-rose` |
| `group-shopping` | `Theme.Group.shopping.color` | `#ec4899` | `#ec4899` | = `accent-pink` |
| `group-money` | `Theme.Group.money.color` | `#64748b` | `#64748b` | = `accent-slate` |
| `kind-activity` | `TripItem.Kind.activity.color` | `#e11d48` | `#e11d48` | = `accent-rose` |
| `kind-meal` | `TripItem.Kind.meal.color` | `#facc15` | `#facc15` | = `accent-yellow` |
| `kind-transit` | `TripItem.Kind.transit.color` | `#2563eb` | `#2563eb` | = `accent-blue` |
| `kind-stay` | `TripItem.Kind.stay.color` | `#7c3aed` | `#7c3aed` | = `accent-violet` |
| `kind-note` | `TripItem.Kind.note.color` | `#64748b` | `#64748b` | = `accent-slate` |
| `launch-background` | `Theme.launchBackground` | `#3b82f6` | `#3b82f6` |  |
| `logo-outline` | `Theme.logoOutline` | `#1d4ed8` | `#1d4ed8` |  |
| `logo-inner` | `Theme.logoInner` | `#2563eb` | `#2563eb` |  |
| `logo-wool` | `Theme.logoWool` | `#ffffff` | `#ffffff` |  |

`AppTheme` in `Hub/AppSpace.swift` already groups the apps; give it a `group: Theme.Group` (finance → money, food → food, health → health, culture → fun, travel → travel) so app icons, Today cards and the ☰ switcher headers use the same colours.

**Done when:** it builds; every existing screen still renders (in both modes) with the new navy-tinted neutrals; `git diff --stat` touches only `Theme.swift` (and `Assets.xcassets/LaunchBackground` only if you change it).

## D2 · A design lint that stops drift

**Change:** add `scripts/design-lint.sh`, a plain grep that counts `Color(hex:`, numeric `cornerRadius:`, `.font(.system(size:` and numeric `.padding(` in `ios/Wooli/Wooli/**/*.swift`, excluding `Theme.swift` and `Shared/DesignSystem/`. Commit today's counts as a baseline in `scripts/design-lint-baseline.txt`, and fail if any count goes **up**. Add `npm run lint:design` and a CI step (Linux is fine; it's only grep). Lower the baseline as later steps remove the old code.

**Done when:** CI runs it, it passes on main, and adding one `Color(hex: "#fff")` to a view makes it fail.

## D3 · Shared components

**Change:** build each component from `components/<Name>.md` in `Shared/DesignSystem/`. Start with the ones every module needs, then the travel motifs:

1. `WooliButtonStyle` (primary / secondary / tertiary): `components/Button.md`
2. `ItemRow` with leading and trailing slots and an optional bar: `ItemRow.md`
3. `EmptyState`: `EmptyState.md`
4. `SectionBand`, extracted from `TripLegHeader` in `Trips/TripLegViews.swift`: `SectionBand.md`
5. `HeroCard` and `RouteProgress`: `HeroCard.md`
6. `TicketCard`, extracted from `TripTravelCard`: `TicketCard.md`
7. `LuggageTag`, `RankStamp`, `Postcard`, `CinemaStub`, `DepartureBoard`, `SuitcaseSticker`
8. Restyle the existing `PendingBadge`, `CategoryTile`, `SectionLabel`, `BarGauge` and `CardModifier` in `Theme.swift` to their component files.

**Done when:** each component's `#Preview` matches its PNG in `reference/` in both modes, with VoiceOver labels as the component file describes. Nothing in the modules uses them yet.

## D4 · Budget

Read `screens.md` → Budget, and `reference/ScreensOverview-*.png` (left phone).

- `DashboardView`: replace `PaceCard` + `SpendingComparisonCard` with a `HeroCard` + `RouteProgress` ("Left to spend", day N of the month, "$X under/over your usual pace"). The full pace chart moves to the hero's detail screen. Keep "Edit Home" ordering, with the hero pinned first.
- `ReviewPreviewCard` becomes a `SectionBand` "Needs review" (brand blue, count as badge) + `ItemRow`s + a secondary "Review all" button.
- `BudgetView`: each group becomes a `SectionBand` in its `Theme.Group` colour; categories become `ItemRow`s with a `BarGauge` (amber near the limit, `expense` over). Remove the Planned / Remaining header.
- `RecurringView`: the upcoming list becomes a `DepartureBoard` (PAID / DUE / LATE).
- `TransactionRow` becomes an `ItemRow` configuration; tags become `LuggageTag`s.
- Net worth moves from the dashboard to `AccountsView`.

**Needs a mapping:** each default category group in `Models/DefaultCategories.swift` gets a `Theme.Group`. Proposed:

| Default group | `Theme.Group` |
|---|---|
| Food & Dining | food |
| Home | home |
| Bills & Other | home |
| Transportation | travel |
| Travel | travel |
| Health & Personal | health |
| Entertainment | fun |
| Shopping | shopping |
| Family & Pets | home (confirm with the user) |
| Income | money |
| Transfer | money |

Store the group on `BudgetCategory` as a new string property with a default (per the CloudKit rules in the backlog), derive it from the table above for existing categories, and let a user-made group pick its own in the category editor. Confirm the mapping with the user before migrating existing data.

## D5 · Trips

- Swap in the shared `TicketCard`, `SectionBand` and `TimelineItem`. City bands are all `Theme.Group.travel`; plan kinds use their group colours (`kind-*` in the table).
- Remove `TripLeg.colorHexes` cycling.
- Bring the 9 fixed font sizes and 8 radii onto `WooliFont`, `Space` and `Radius`.
- Add the "N to try in <city>" `ItemRow` under each city, from Eats' want-to-try places in that city.

## D6 · Eats

Read `screens.md` → Eats, `components/RankStamp.md` and `reference/ScreensEats-*.png`.

- Overview hero: `HeroCard` passport (count, cities, last 4 stamps). Rows: `ItemRow` + small `RankStamp`.
- Replace `MealScoreBadge` with `RankStamp`. The rank is the place's position in your list (sort by the existing score); the tier comes from the existing `MealSentiment`: `mustTry` and `liked` → Loved, `fine` → Fine, `disliked` → Skip. No model change. Movies use the same mapping.
- `RankFlow` keeps its logic; restyle "which was better?" as the face-off of two stubs with a step count.
- Place detail: `display` title + 92pt stamp, notes as a `Postcard`, visits as `ItemRow`s.

## D7 · Movies, Recipes, Period

- **Movies:** `CinemaStub` hero, `ItemRow`s with posters and small stamps, the same face-off.
- **Recipes:** `HeroCard` hero; detail with `display` title, `LuggageTag`s, a `Postcard` "From <place>", ingredient and step cards.
- **Period:** `HeroCard` + `RouteProgress` (day N of the cycle).

## D8 · Today

`Hub/TodayView.swift`: a `DepartureBoard` "Next up" across modules (bills due, reservations, the next leg, period prediction), a card of shortcuts, then "Your stickers".

## D9 · Suitcase stickers

**Needs a product decision first:** which milestones exist, and where they're stored. Proposed: derive them on the fly from existing data (places stamped, cities visited, months under budget, review streak), with nothing new stored. Ask the user before building.

---

When a step changes how something should look, update the matching file in this folder in the same commit, so the design system stays the source of truth. The live, editable version is the Wooli design system artifact linked in `README.md`.
