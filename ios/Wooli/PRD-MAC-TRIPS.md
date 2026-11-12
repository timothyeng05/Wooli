# Wooli for Mac — Trips PRD (public launch)

**Status:** approved to build, defaults in section 12 accepted by the user 2026-11-12 · written by Claude (PM pass)
**Builds on:** `BACKLOG.md` (collaboration rules, Done log), `DesignSystem/README.md` (tokens and components), `MODULES_SPEC.md`
**For the builder:** each item in section 7 is one backlog item. Claim it in `BACKLOG.md` → Phase M, build it, log it in Done. Read section 5 (principles) and section 6 (data model) before any item.

---

## 1. Summary

Wooli on the Mac is a set of iPhone screens in a Mac window, plus one screen that is properly Mac-shaped: the trip workspace. That workspace is already the best thing in the app, and trips are the only part of Wooli a stranger can use in the first minute (no bank, no paid third-party service, and inviting someone brings a second user).

**The bet:** launch Wooli on the Mac App Store with Trips as the front door. The Mac is where trips get planned; the iPhone is what you carry on the trip. Budget, Eats and the rest come along as the reasons to stay.

This PRD covers four releases:

| Release | Theme | Outcome |
|---|---|---|
| **M1** | Plan fast | A new user goes from install to a real multi-city plan in minutes, in an app that behaves like a Mac app. Ships to the App Store. |
| **M2** | Bookings and money | Every confirmation in one place, a trip budget that compares plan to real spending, and ways to get the trip out (print, PDF, calendar, file). |
| **M3** | A plan that checks itself | Time zones, travel times, conflicts, weather, and a trip Overview that says what's left to do. |
| **M4** | Reasons to come back | Places-been globe, checklists, attachments, Spotlight and Handoff. |

---

## 2. Evaluation of the Mac app today

How this was done: a full read of the Mac shell and Trips code, and the user's three live trips through the Wooli MCP tools. **Not done:** looking at the running app (screen access was declined), so visual polish, dark mode and real pointer behaviour are unverified. Items marked ⚠ need a look on screen before they're trusted.

### What works

- **The trip workspace is real Mac software.** Three panes, multi-select, drag between days and Ideas, ⌘↑/⌘↓, right-click menus, autosaving inspector, own window (`Trips/MacTripWorkspace.swift`).
- **The look has a point of view.** Boarding-pass tickets, city bands, Eats stamps on meals. It doesn't look like Wanderlog or TripIt.
- **Sharing costs nothing to run.** Each trip is a CloudKit zone shared by iCloud invite; storage is the user's own iCloud.
- **Things competitors don't have:** points and miles next to cash on every booking, a planning-coverage heatmap, your own restaurant scores on trip meals, friends' restaurants near the trip, and Claude editing the trip through the MCP server.
- **Privacy is a real selling point** and already true: no account, no server.

### What's wrong

| # | Problem | Evidence | Severity |
|---|---|---|---|
| E1 | **A new trip is an empty shell full of fake plans.** "Spain 2026" starts in six weeks and holds 33 plans, all of them the Breakfast / Lunch / Dinner placeholders created with the trip. Nothing real. | `TripItem.mealPlaceholders`; live data | High |
| E2 | **Adding a plan takes too many steps.** ⌘N makes an untitled Activity; you type a title, then open a place search sheet, then pick a type. Planning a trip is adding 50–100 places. | `MacTripWorkspace.addPlan`, `MacPlanInspector` | High |
| E3 | **Creating a trip is a four-page iPhone form** in a sheet. Cities are free text with no location, so the app geocodes the name later to bias search (which once put Lijiang 400 km off). | `NewTripFlow`, `TripLeg` has no coordinates | High |
| E4 | **The map is the smallest pane.** It sits above the inspector in a 300–560 pt column. The user already said it was "useless being so small"; three sizes helped but it still competes with the inspector for the same column. | `MacTripWorkspace.inspector` | High |
| E5 | **No undo.** Deleting or moving a plan can't be undone; deletes ask for confirmation instead. | no `UndoManager` anywhere | High |
| E6 | **The menu bar doesn't know Trips exists.** Go has Budget pages only; there's no New Trip, no trip commands, and the workspace's shortcuts are invisible buttons. | `WooliCommands` | Medium |
| E7 | **Trips live two levels deep.** Apps popover → card grid → push into a trip → Back. No way to jump between trips or reopen where you left off. | `MacShellView`, `TripsListView` | Medium |
| E8 | **"Booked" is a notes hack.** A booking counts as unbooked if its notes start with "not booked yet". | `TripCoverage.isUnbooked` | Medium |
| E9 | **Costs don't add up to one number.** Totals show per currency ("$1,240 + ¥86,000"), there's no trip budget, and nothing links to real spending, even though the bank transactions are in the same app. | `TripCosts` | Medium |
| E10 | **Bookings are scattered.** Confirmation codes, terminals and check-in times are inside individual plans. There's no one list to read at an airport or a hotel desk. | — | Medium |
| E11 | **Nothing gets in or out.** No paste-a-confirmation, no drop a link, no print, PDF, calendar or file export. A companion without Wooli gets nothing. | — | Medium |
| E12 | **The plan doesn't check itself.** No time zones per city, no travel time between stops in the list, no warning when a flight lands after a check-in closes or a plan sits in the wrong city. | — | Medium |
| E13 | **Design-system drift in Mac-only code.** Trip cards use six hard-coded hex colours and decorative emoji; the coverage card uses money green. Both break `brand.md`. | `TripCard`, `TripEmoji`, `TripCoverageCard` | Low |
| E14 | **Not ready for strangers.** The sample trip is a DEBUG flag; onboarding is the iPhone's; the listing and screenshots are iPhone-only; five CloudKit fields are not yet in Production. | `addSampleTrip`, `AppStore/listing.md`, BACKLOG release checklist | Blocker for launch |

---

## 3. Who it's for

**The planner (primary).** Plans two to four multi-city trips a year for themself and a partner or friends. Today: a Google Doc or spreadsheet, Google Maps saved lists, a notes app, and confirmations lost in email. Plans at a laptop over several evenings. Wants one place that is fast to fill and that tells them what's still missing.

**The companion.** Invited by the planner. Adds a few ideas, mostly reads. Often on iPhone only. Must be able to join in one tap and see the plan without learning the app.

**The points traveller.** Books award flights and hotel nights. Wants cash and points tracked side by side and a real cost for the trip. Small group, loud advocates. Already served; keep it working and visible.

### Jobs to be done

1. When I've decided to go somewhere, I want to rough out cities and nights in a minute, so I can see the shape of the trip.
2. When I find a place (a link, a reel, a friend's tip), I want to drop it into the trip without filing it, so nothing is lost.
3. When I book something, I want the confirmation in the trip without retyping it.
4. When I sit down to plan, I want to see what's still open (nights without a bed, days with nothing), so I know what to do next.
5. When I'm arranging a day, I want to see it on a map with travel times, so the day is realistic.
6. When the plan is good enough, I want to share it with people who don't have the app.
7. When the trip is over, I want to know what it really cost.

---

## 4. Goals, non-goals, measures

### Goals

- **G1** A first-time user creates a multi-city trip and adds ten places in under five minutes, without reading anything.
- **G2** Every booking for a trip is findable in one list in under five seconds.
- **G3** The app says what's unplanned and what conflicts, without being asked.
- **G4** The Mac app passes App Review and stands on its own for someone with no iPhone.
- **G5** Everything above ships with no Wooli server and no account.

### Non-goals (this PRD)

- Booking or searching flights and hotels, or price tracking.
- Live flight status (needs a paid data feed and a server).
- Automatic email scanning (needs mailbox access; paste and drop cover it).
- A web viewer for shared trips (needs a server; PDF and file export cover it for now).
- Splitting costs between travellers and settling up.
- AI-written itineraries inside the app. Claude through the MCP server already does this for users who want it.
- Android or web clients.

### How we'll know

Wooli collects no analytics, and that stays. Measures come from task tests, App Store Connect's opt-in numbers and feedback.

| Measure | Target | Source |
|---|---|---|
| Time from first launch to a trip with 2 cities and 10 placed plans | under 5 min, median of 5 testers | Timed test with the script in section 10 |
| Clicks and keystrokes to add a known restaurant to a day | 1 shortcut + typing + Return | Task test |
| Find a flight's confirmation code | under 5 s | Task test |
| App Store rating (Mac) | 4.5 or better after 50 ratings | App Store Connect |
| Day-30 retention of opted-in users | 25% or better | App Store Connect |
| Crash-free sessions | 99.5% or better | Xcode Organizer |
| Trips with at least one accepted invite | track only | TestFlight feedback, support mail |

---

## 5. Product principles for the builder

1. **Capture first, file later.** Anything can be added with a name alone. Type, day, time and place are all optional and fixable afterwards.
2. **The plan is a document.** It autosaves, undoes, prints, exports and opens in its own window, like a Pages document.
3. **Show the gaps.** Open slots are drawn as open slots. Never create records to stand in for missing plans.
4. **One trip, one window, no pushes.** Inside a trip, the sidebar changes what the window shows. Nothing navigates "forward" and nothing needs a Back button.
5. **Every action has a menu item and a shortcut.** If it's only reachable by right-click or hover, it isn't done.
6. **Shared data is sacred.** Never delete or rewrite other people's records as a side effect of an upgrade. New fields are optional and old builds must keep working.
7. **Nothing leaves the Mac without the user knowing.** Any new network call (weather, exchange rates, Google search) is listed in section 9 and on the privacy page before it ships.
8. **Design system only.** `Theme` tokens, `Space`, `Radius`, shared components. No new `Color(hex:)`, no numeric radii, no fixed font sizes. Emoji only where the user chose them. One hero object per screen.

---

## 6. Data model changes

All trip data lives in CloudKit zones through `TripStore` (not SwiftData). Rules that apply to every change here:

- Every new field is optional and decoded with `decodeIfPresent`, so older builds and older records keep opening.
- A new CloudKit field is only written when it has a value (the existing pattern for `order`, `cost`, `points`), because a save with a field Production doesn't know fails whole.
- **To stop deploying the schema for every feature, add one JSON string field named `extras` to both `Trip` and `TripItem` records.** New optional values go inside it. One schema deploy covers M1 through M4.
- The MCP tools (`WooliMCPTools.swift`) read and write the same structs; extend `wooli_trips` and `wooli_edit_trip` whenever a field here is added.

### 6.1 `TripLeg` (stored as JSON inside `Trip.legs`, no schema change)

| Field | Type | Purpose |
|---|---|---|
| `latitude`, `longitude` | `Double?` | The city's centre, from Apple Maps when the city is picked |
| `timeZoneID` | `String?` | e.g. `Europe/Madrid`; from the map item, else from the coordinate |
| `countryCode` | `String?` | ISO code, for currency defaults and the places-been globe |
| `mapItemID` | `String?` | Apple Maps place ID |

Existing legs have none of these. Backfill lazily: when a trip opens, geocode any leg without coordinates once (name plus the trip's destination as a hint), save the result, and never overwrite a value a user set.

### 6.2 `Trip.extras` (new record field `extras`, JSON)

| Key | Type | Purpose |
|---|---|---|
| `budget` | `Double?` | Trip budget in `budgetCurrency` |
| `budgetCurrency` | `String?` | ISO code; defaults to the device currency |
| `fxRates` | `[String: Double]?` | Units of `budgetCurrency` per 1 unit of each foreign currency, as set for this trip |
| `fxUpdatedAt` | `Date?` | When rates were last fetched or edited |
| `homeLegHidden` | `Bool?` | Reserved |
| `checklist` | `[ChecklistItem]?` | M4: `{id, title, done, group}` |

### 6.3 `TripItem.extras` (new record field `extras`, JSON)

| Key | Type | Purpose |
|---|---|---|
| `status` | `"idea" \| "planned" \| "booked" \| "cancelled"`, optional | Replaces the "not booked yet" notes prefix. Missing = `planned`. |
| `endTime` | `Int?` | Minutes after midnight; for activities with a fixed slot (a tour, a reservation) |
| `url` | `String?` | A link for the plan (booking page, menu, article) |
| `source` | `String?` | Where it came from: `quickAdd`, `import`, `eats`, `sights`, `claude`, `share` |
| `attachmentIDs` | `[String]?` | M4 |
| `paidBy` | `String?` | Reserved for a later cost-splitting feature; do not build UI |

**Migration of the notes hack:** on read, an item whose notes start with "not booked yet" and that has no `status` is treated as `planned` for travel and stays (i.e. not booked). `TripCoverage.isUnbooked` becomes `status != .booked` for travel and stays that have a status, and falls back to the notes prefix otherwise. When a user sets a status on such an item, strip the prefix from the notes in the same save. Don't rewrite notes in bulk.

### 6.4 Meal placeholders (retired)

- Stop creating them: remove the `mealPlaceholders` call from trip creation.
- Existing placeholder records are **not deleted** (principle 6). They're hidden: every list, count, map and export skips `isMealPlaceholder` items. Coverage already ignores them.
- The open slots the placeholders stood for are now drawn from `TripCoverage` (see M1-5).
- Filling an open meal slot on a day that still has a matching placeholder record reuses that record (update it in place) instead of adding a second one.
- Trip menu → "Remove empty meal slots" deletes this trip's placeholders for everyone, after a confirmation that says so. Optional clean-up, never automatic.

### 6.5 Private, per-user data (SwiftData, the user's own iCloud; never in a shared zone)

New model `TripSpendLink` (add to the `Schema` in `WooliApp.swift` and to `Deduplicator`, every property defaulted):

| Field | Type | Purpose |
|---|---|---|
| `tripID` | `String` | Which trip |
| `tag` | `String` | The Budget tag whose transactions count toward this trip |
| `includedTransactionIDs` | `[String]` | Transactions added by hand or accepted from suggestions |
| `excludedTransactionIDs` | `[String]` | Suggestions the user rejected |

Bank transactions never enter a trip zone. Companions see planned costs (already shared) and never the owner's real spending.

### 6.6 CloudKit Production deploy (gate for M1 release)

Already waiting: `TripItem.order`, `cost`, `currency`, `points`, `pointsProgram`. New: `Trip.extras`, `TripItem.extras`. To create them in Development, run a Debug build signed in to iCloud and save one trip and one plan with a value in each. Then CloudKit Console → Deploy Schema Changes. M4 attachments add a record type later (section 7, M4-3).

---

## 7. Requirements

Priority: **P0** must ship in that release · **P1** should · **P2** if time allows. Each item lists acceptance criteria (AC) the builder checks before logging it Done.

### Release M1 — Plan fast (App Store launch)

#### M1-1 · Trips gets a sidebar; no more push navigation · P0

**Why:** E7. The shell already gives a sidebar to "an app with pages of its own" (Budget). Trips now has pages.

**Design.** Keep the Apps popover at the top right as the way to switch apps. When Trips is the current app, the window is a `NavigationSplitView` with a labelled sidebar (220 pt, min 190, max 300), not Budget's icon rail.

```
┌──────────────────────┬──────────────────────────────────────────────────────┐
│ ▦ All trips          │                                                      │
│                      │                                                      │
│ UPCOMING             │                                                      │
│ ▾ Spain 2026   in 42d│                                                      │
│     Overview         │           (content for the selected row)             │
│     ① Madrid   3 d   │                                                      │
│     ② Seville  2 d   │                                                      │
│     ③ Barcelona 5 d  │                                                      │
│     Bookings     4   │                                                      │
│     Costs            │                                                      │
│     Ideas       12   │                                                      │
│ ▸ China        Mar 31│                                                      │
│                      │                                                      │
│ PAST                 │                                                      │
│ ▸ Japan + Seoul 2026 │                                                      │
│                      │                                                      │
│ ＋ New trip          │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

- **All trips** shows the gallery (M1-8).
- A trip row expands to its pages: **Overview**, one row per city (number badge or the user's emoji, travel blue, NOW pill when today falls in it), **Bookings**, **Costs**, **Ideas** (with count). Only one trip is expanded at a time; selecting another collapses the last.
- Selecting **Overview** before M3 ships shows the plan for the whole trip with the trip summary in the inspector (today's "Whole trip" behaviour). M3-5 replaces it.
- Selecting a city shows the plan scrolled to and filtered to that city's days (today's `focusLeg` behaviour), with the map framed on it.
- Bookings and Costs rows appear when M2 ships; hide them until then.
- Ideas is still a drop target: drag plans onto the row to unschedule them.
- Trip rows have a context menu: Open in New Window, Edit Trip…, Duplicate Trip (M4), Export… (M2), Delete Trip… / Leave Trip….
- The trip's own window (`WindowGroup("Trip")`) shows the same sidebar with only that trip.
- Selection is restored on relaunch (`SceneStorage`: trip id + page).

**AC**
- No Back button exists anywhere in Trips on the Mac.
- Switching between two trips is one click.
- Quit and reopen returns to the same trip and page.
- The iPhone trip list and trip page are unchanged.
- The Budget rail and Apps popover behave as before.

**Touches:** `Views/MacShell.swift` (a `MacSection.trip(id, page)` case, `hasSidebar` true for Trips), `Trips/MacTripWorkspace.swift` (its `sideColumn` moves into the shell sidebar), `Trips/TripViews.swift` (`TripsListView.cardGrid` becomes the All trips page).

#### M1-2 · Workspace layout: plan, map, inspector · P0

**Why:** E4. A list beside a big map is the layout people already know from Wanderlog, Google Maps lists and Apple Maps guides. The inspector is secondary and should behave like every other Mac inspector.

```
┌─ sidebar ─┬──────── plan ─────────┬───────────── map ──────────────┬─ inspector ─┐
│           │ [Add to Day 3…      ] │                                │  (on demand) │
│           │ ━ ② Seville ━━━━━━━━━ │        ①───②                   │  Food        │
│           │ Sun 27 Dec · Day 4    │         ╲   ③                  │  El Rinconc… │
│           │  ✈ MAD → SVQ  9:40    │          ④                     │  Day · Time  │
│           │  · 14 min walk        │                                │  Place       │
│           │  ● Real Alcázar       │                                │  Cost        │
│           │  ○ Lunch — open       │                                │  Notes       │
│           │  ● El Rinconcillo 9.1 │                                │              │
└───────────┴───────────────────────┴────────────────────────────────┴──────────────┘
```

- Toolbar view switch: **Itinerary · Calendar · Map**, ⌘1 / ⌘2 / ⌘3 (the Go menu becomes context-aware, see M1-7).
  - **Itinerary** (default): plan column (min 400) + map (min 360, takes the remaining width).
  - **Calendar:** the day columns, full width; the map is hidden by default.
  - **Map:** the map full width with the floating selected-plan card (keep the current full-map behaviour).
- **Show/Hide Map** ⇧⌘M in Itinerary and Calendar. The three-size map handle and its drag bar are removed.
- **Inspector** uses SwiftUI's `.inspector(isPresented:)`, 320 pt (min 280, max 420), toggled with ⌥⌘I and a toolbar button. It opens when a plan is selected by double-click, Return, or ⌘I; single selection alone doesn't open it but updates it if it's already open. This keeps the map visible while arrow-keying through a day.
- Under 1,180 pt of window width the inspector takes the map's place while open, instead of squeezing three columns.
- The map shows: the selected day numbered in order with routes (when one plan or a day header is selected), the selected plans, the chosen city, or the whole trip. Clicking a pin selects its plan and scrolls the plan column to it. Selecting a plan pans the map only if its pin is off screen.
- Map pins take the plan's group colour and symbol. Ideas with a place show as hollow pins when the Ideas page or "Show ideas on map" (map options menu) is on.
- With nothing selected, the inspector (when open) shows the trip or city summary: dates, counts, the Planning card and the Costs card, as today.

**AC**
- At 1,440 × 900 the map is at least 45% of the window width in Itinerary view.
- Arrow keys move the selection through plans and across days; the map follows without the layout changing.
- ⌥⌘I, ⇧⌘M, ⌘1–3 work and appear in the View menu.
- Layout choices persist per window.
- Everything the old inspector could edit is still editable.

**Touches:** `Trips/MacTripWorkspace.swift` (replace the `HSplitView`/`inspector`/`mapHandle`/`fullMap` layout; keep `MacTripMap`, `MacPlanInspector`, `place(...)`, `nudge`).

#### M1-3 · Quick add · P0

**Why:** E2, job 2. This is the core loop; it has to be the fastest thing in the app.

**Design.** A capture field at the top of the plan column, focused with ⌘N. Its placeholder names the target: "Add to Sun 27 Dec…" (the selected plan's day, else the day header last clicked, else the first day of the chosen city, else Ideas). Tab cycles the target: this day → Ideas.

As the user types, a suggestion list drops down:

```
┌ Add to Sun 27 Dec… ─────────────────────────────────────┐
│ el rinc|                                                 │
├──────────────────────────────────────────────────────────┤
│ 🍴 El Rinconcillo · C. Gerona 40, Seville        Food ⏎ │
│ 🍴 El Rincón de Beirut · Seville                 Food   │
│ ★  El Rinconcillo — on your Want to Try              Eats │
│ ＋ Add "el rinc" without a place                          │
└──────────────────────────────────────────────────────────┘
```

- Suggestions come from, in order: the user's own Eats Want-to-Try and Sights Want-to-go near this city, then `MKLocalSearchCompleter` biased to the leg's coordinates (M1-4), then the existing Google fallback under its existing rules (M1-10 adds consent).
- **Return** adds the highlighted suggestion and keeps the field focused and empty, so the next place can be typed straight away. **⌥Return** adds and opens the inspector. **Esc** clears, then leaves the field.
- The type is inferred from the map item's category: restaurants, cafés, bars, bakeries → Food; hotels and lodging → Stay; airports, stations, ferry terminals → Travel; everything else → Activity. A wrong guess is one click to fix in the row's type menu.
- Typed shortcuts, matched at the start: a flight number (two letters or letter-digit, then 1–4 digits, e.g. `CX831`, `IB 6250`) offers "Flight CX831" and opens the ticket editor with the number, airline and day filled; `hotel `, `stay ` → Stay; `train `, `fly `, `flight `, `bus `, `ferry ` → Travel; `eat `, `lunch `, `dinner `, `breakfast `, `coffee ` → Food, and a meal word puts it in that open slot.
- A time typed at the end (`7pm`, `19:30`) is set on kinds that use time; on other kinds it only orders the day (existing rule).
- Pasting several lines offers "Add 6 places": one search per line, a review list with the match found for each (or "no place"), and Add All.
- Each day header keeps a ＋ that focuses the field with that day as the target.

**AC**
- From a selected day: ⌘N, type a restaurant's name, Return. The plan appears on that day with the right place and type, and the field is ready for the next. No sheet opens.
- Adding ten known places in a row takes under 90 seconds.
- Suggestions for a Seville day never lead with places near the user's home.
- Works offline for the "without a place" row; place rows show a quiet "Offline" note.
- All adds are undoable (M1-6).

**Touches:** new `Trips/QuickAdd.swift` (view + `QuickAddParser`, pure and unit-tested: flight-number detection, prefixes, trailing time, category → kind), `PlaceSearcher` (accept a coordinate region directly), `MacTripWorkspace.addPlan`.

#### M1-4 · New trip in one sheet, with real cities · P0

**Why:** E3, job 1.

```
┌ New trip ────────────────────────────────────────────────────┐
│ Name   [ Spain 2026                         ]                │
│ Starts [ Thu 24 Dec 2026 ▾ ]   from  [ New York ▾ ] (home)   │
│                                                              │
│ Cities                                         nights        │
│ ≡ ① Madrid, Spain                              [ 2 ] − +     │
│ ≡ ② Seville, Spain                             [ 2 ] − +     │
│ ≡ ③ Barcelona, Spain                           [ 5 ] − +     │
│   [ Add a city…                 ]                            │
│                                                              │
│ Thu 24 Dec – Sun 3 Jan · 10 nights · back in New York        │
│                                        [ Cancel ] [ Create ] │
└──────────────────────────────────────────────────────────────┘
```

- One sheet on the Mac (the iPhone keeps its stepped flow, but gets the same city search and nights steppers).
- "Add a city" is a search field (`MKLocalSearchCompleter`, addresses filtered to localities and regions). Picking one stores name, coordinates, time zone, country code and map item ID on the leg. Typing a name and pressing Return without picking still works (a leg with no coordinates, backfilled later).
- Nights steppers set each city's dates in sequence from the start date; the end date is computed and shown. Drag ≡ to reorder; dates follow.
- Home city: remembered between trips (`trips.homeCity` in UserDefaults, with coordinates). It becomes an `isHome` leg on the first day and the last day. "No home city" is allowed.
- Name is prefilled from the cities ("Madrid, Seville & Barcelona") until the user types one. `destination` is filled from the countries or cities and is no longer asked for.
- No meal placeholders are created (6.4).
- After Create: the trip is selected in the sidebar, its Overview (or plan) is showing, and the quick-add field has focus.
- **Edit Trip…** uses the same sheet. Changing nights or order moves each city's plans with their city (a plan on Seville's day 2 stays on Seville's day 2). Plans on days that no longer exist go to Ideas, with a count in the confirmation ("3 plans will move to Ideas").

**AC**
- A three-city trip is created with the keyboard alone in under 60 seconds.
- Every picked city has coordinates and a time zone on its leg.
- Shortening a city never deletes a plan.
- A trip made on the new Mac build opens correctly on the current iPhone build.

**Touches:** `Trips/TripViews.swift` (`NewTripFlow`, `TripEditor`, `TripLegEditor`), new `Trips/TripSetup.swift`, `TripModels.swift` (leg fields), `TravelLegs.swift`. Unit tests for the date arithmetic and the move-plans-with-city rule.

#### M1-5 · Open slots replace placeholders · P0

**Why:** E1, principle 3, job 4.

- In the Itinerary, each day shows its real plans, plus quiet one-line open slots for what `TripCoverage` says is missing: meals with nothing (Breakfast, Lunch, Dinner), "No stay tonight" at the end of a day with no bed, and "Travel to Seville not booked" on a change day.
- An open slot is a row with a dashed outline in `text-tertiary`, never a filled card. Clicking it focuses quick add with that slot as the target (meal word or type prefilled). Dragging an idea onto it fills it.
- Toolbar toggle **Show open slots** (default on; ⇧⌘O). Off gives a clean itinerary for reading or screenshots.
- Open slots are views, never records. They don't appear in exports, counts, the map, or MCP output.
- The Planning card moves off money green (E13): planned = `brand`, open = `track`, unbooked = dashed `brand` outline. Update `DesignSystem/components` if a token is missing rather than inventing a colour.

**AC**
- A new trip shows zero plans and its open slots.
- "Spain 2026" (33 placeholders) shows zero plans and the same open slots, and its records are untouched in CloudKit.
- Filling a Lunch slot on a day with an old Lunch placeholder leaves exactly one Lunch record.
- `TripCoverageTests` still pass; add tests for slot derivation.

**Touches:** `TripCoverage.swift`, `TripCoverageCard.swift`, `TripLegViews.swift` (`TripLayout`, `TripRow` gains `.openSlot`), `TripViews.swift` (`TripDetailView`), `TripStore.swift`.

#### M1-6 · Undo and redo · P0

**Why:** E5, principle 2.

- `TripStore` registers every user edit with the window's `UndoManager`: add, delete, move (one undo step for a multi-plan drag), field edits (one step per inspector commit, not per keystroke), trip edits from M1-4.
- Deleting plans no longer asks for confirmation; it deletes and shows "Deleted 3 plans · Undo" in a transient bar for six seconds. Deleting or leaving a **trip** still confirms.
- Undo restores a deleted plan with the same record id so it syncs back as the same plan.
- Edit menu shows named actions ("Undo Move Plan").
- Changes that arrive from sync or from Claude's import are not on the undo stack.

**AC**
- ⌘Z after each of: add, delete, drag to another day, ⌘↑, retitle, change type, edit trip nights. Each returns the exact prior state, and ⇧⌘Z reapplies it.
- Undoing a delete of a shared plan restores it for the other person.

**Touches:** `TripStore.swift` (wrap `save`/`delete` in an undo-registering layer that takes before/after snapshots), `MacTripWorkspace.swift`, `MacPlanInspector`.

#### M1-7 · Menus, shortcuts, command palette · P0 (menus) / P1 (palette)

**Why:** E6, principle 5.

| Menu | Items |
|---|---|
| File | New Trip ⇧⌘N · New Plan ⌘N · New Window for Trip ⌥⌘N · Import… ⇧⌘I (M2) · Export ▸ (M2) · Print… ⌘P (M2) · Sync ⌘R |
| Edit | Undo/Redo · Cut/Copy/Paste plans · Duplicate ⌘D · Delete ⌫ · Find in Trip ⌘F |
| View | Itinerary ⌘1 · Calendar ⌘2 · Map ⌘3 · Show Map ⇧⌘M · Show Inspector ⌥⌘I · Show Open Slots ⇧⌘O · Show Sidebar ⌃⌘S |
| Plan (new, enabled in a trip) | Move Up ⌘↑ · Move Down ⌘↓ · Move to Previous Day ⌥⌘↑ · Move to Next Day ⌥⌘↓ · Move to Ideas ⇧⌘U · Mark as Booked ⌘B · Set Type ▸ · Open in Maps ⌘⏎ · Edit Ticket… |
| Go | Today ⌘0 · Go to Trip… ⌘K (palette) · Next City ⌘] · Previous City ⌘[ · Today in Trip ⌘T |

- ⌘1…⌘5 belong to the current app: Budget's pages in Budget, the trip views in Trips. The Go menu lists whichever set applies.
- Copy puts plans on the pasteboard as Wooli plans **and** as plain text (title, place, address, one per line), so pasting into Notes or Messages gives something readable. Paste in a trip adds copies to the target day; pasting plain text runs quick add's multi-line import.
- Space on a selected plan shows a Quick-Look-style place card (map, address, Look Around when available, your Eats score).
- **Command palette (⌘K), P1:** one field over the window. Finds trips, cities, plans, apps and Budget pages by name, and runs any menu command by name. Return goes or runs.
- Remove the invisible shortcut buttons in `MacTripWorkspace.shortcuts`; real menu commands replace them (`FocusedValue` for the active workspace).

**AC**
- Every action in the plan context menu also exists in the menu bar.
- With the mouse unplugged, a tester can create a trip, add five places, reorder them, move one to another day, mark a flight booked and delete a plan.
- No shortcut clashes with a system one (check ⌘T, ⌘B, ⌘K against the standard menus that exist in the app).

**Touches:** `Views/MacShell.swift` (`WooliCommands`), new `Trips/TripCommands.swift`, new `Views/CommandPalette.swift`.

#### M1-8 · All trips gallery · P1

**Why:** E13, first impression.

- Top: the next trip as one `TicketCard` hero (from → to, dates, "in 42 days", cities, the coverage sentence "23 of 141 planned · 7 nights without a bed"). During a trip it shows today's day and next plan. This is the page's single hero object.
- Below: Upcoming and Past as plain `card` tiles: name, cities, dates, a small route line of city dots, shared-with avatars or count. No gradient tiles, no guessed emoji, no hex colours (delete `TripEmoji` and `TripCard.tint`). A trip may show an emoji only if the user picked one in Edit Trip.
- Empty state (no trips): `EmptyState` with two buttons: **New trip** and **Explore a sample trip** (M1-9).
- Drop a `.woolitrip` file on the page to import (M2-5).

**AC:** design lint passes with a lower baseline than before; both themes checked on screen.

#### M1-9 · First run for a stranger on a Mac · P0

**Why:** E14, G4.

- Onboarding on the Mac: the existing "Make Wooli yours" app picker, then **straight into the app** on All trips. No Budget tour and no SimpleFIN step unless Budget was switched on, as today.
- **Sample trip** ships in Release builds: "Explore a sample trip" adds the Japan week as a local-only trip marked `isSample` (kept in a UserDefaults id list, never uploaded, banner "Sample trip · Delete" at the top of its plan). `addSampleTrip` moves out of `#if DEBUG` and gains the no-upload guard.
- **No iCloud:** the app is fully usable signed out. Trips save locally; the banner says so once, and Invite explains why it's unavailable. Verify nothing blocks or spins. ⚠
- First open of a trip shows three coach marks, once: the quick-add field ("Type a place, press Return"), the map, and Invite. Reuse `appGuide`.
- Help menu: Wooli Help (opens `/support`), Keyboard Shortcuts (a sheet listing M1-7), Send Feedback.

**AC**
- On a fresh macOS user account with no iCloud: launch → choose Trips only → sample trip is open within three clicks; a real trip can be created and edited; nothing errors.
- Deleting the sample trip removes it completely and it never appears on another device.

#### M1-10 · App Store readiness · P0

See section 9 for the full checklist. Engineering items in this release:

- Google Places fallback asks once before its first use on a device: "Search Google Maps too? Your search text and the trip's city are sent to Google. Wooli sends nothing else." Allow / Not now; a switch in Settings → Privacy. Without consent the fallback row doesn't appear.
- Dark mode and Increase Contrast pass over every Trips screen on the Mac. ⚠
- VoiceOver: every plan row reads as one element (type, title, place, time, status); the map has a list alternative (the plan column); all toolbar items are labelled.
- Performance: a trip with 30 days and 400 plans scrolls without dropped frames and opens in under 300 ms on an M1 Air. `TripStore.items(in:)` filters the whole array on every call; index items by trip id once it shows in a profile.
- Mac window: minimum 900 × 600; state restoration; full screen and Split View checked.

### Release M2 — Bookings and money

#### M2-1 · Booking status · P0

- Travel and stays get a status control in the row, the inspector and the ticket: **Not booked · Booked · Cancelled**. ⌘B toggles Booked. Activities and food can be marked Booked too (a reservation) but don't show a status unless set.
- Not booked draws with a dashed outline (as the Planning card already shows); Cancelled draws struck through and drops out of coverage, costs and the map.
- Stored in `extras.status` with the notes-prefix fallback from 6.3.

**AC:** the China trip's "Not booked yet" bookings show as Not booked with no data change; setting one to Booked removes the notes prefix and updates the Planning card.

#### M2-2 · Bookings page · P0

**Why:** E10, G2.

A sidebar page per trip: a native `Table`, one row per travel plan and stay (plus anything else with a confirmation code or status).

| Column | Notes |
|---|---|
| Status | Booked / Not booked / Cancelled, clickable |
| Type | Flight, train, stay, … (symbol) |
| What | "CX831 JFK → HKG", "Hyatt Regency Hangzhou" |
| When | Departure or check-in date and time, with time zone abbreviation once M3-1 ships |
| Until | Arrival or check-out |
| Confirmation | Monospaced, click to copy |
| Cost | Cash and points |
| City | Leg name |

- Sortable by any column, default by When. Search filters. Group by: none, type, city.
- Select rows to see them in the inspector; double-click opens the ticket editor. Multi-select → Mark as Booked, Copy as Text.
- Header line: "9 of 14 booked · 3 nights without a bed · 2 travel days not booked", each part a click that filters.
- The sidebar row's badge is the count of not-booked items.

**AC:** any confirmation code is reachable in two clicks from anywhere in the trip and copies in one; the table is fully keyboard-navigable.

**Touches:** new `Trips/MacBookingsTable.swift`.

#### M2-3 · Paste or drop a confirmation · P0

**Why:** E11, job 3. Email scanning is out; this is the private version of it.

- **Ways in:** File → Import… ⇧⌘I, ⌘V of text anywhere in a trip that isn't a text field, or drop text, `.eml`, `.pdf` or `.txt` onto the trip window. Dragging a message out of Mail onto the window works.
- **Reading it:** on the Mac, with Apple Intelligence available, a `LanguageModelSession` with `@Generable` output (the pattern in `Recipes/RecipeTagger.swift`) extracts a list of bookings: kind, mode, title, flight number, from/to (airport codes or place names), dates and times, check-in and check-out, confirmation code, price and currency, seats, cabin. PDF and `.eml` text is extracted locally first (PDFKit; MIME text parts).
- **Without Apple Intelligence:** a deterministic parser finds flight numbers, IATA codes from `airports.tsv`, dates, times, a confirmation-code pattern and currency amounts, and prefills what it can.
- **Review sheet, always:** each found booking as an editable row with the day it will land on, a warning when its date is outside the trip, and a duplicate check (same flight number and day, or same stay name and check-in → "Update existing" instead of "Add"). Nothing is saved until **Add to Trip**.
- Places are resolved through the existing lookup (Apple first, 80 km sanity check against the leg).
- Imported plans get `status = booked`, `source = import`.
- The text never leaves the Mac. Say so in the sheet's footer.

**AC**
- Test set of 12 real confirmations (3 airlines, 2 rail, 4 hotel chains, Airbnb, Booking.com, one multi-segment itinerary; anonymised, kept in `WooliTests/Fixtures/Confirmations/`): with the model, ≥ 10 of 12 produce bookings with correct dates, endpoints and code; without it, flight number, date and code are found in ≥ 8 of 12.
- A round-trip flight email produces two flights on the right days.
- Importing the same email twice produces no duplicates.
- Works with the network off (place matching is skipped, and says so).

**Touches:** new `Trips/BookingImport.swift` (extraction + deterministic parser, pure, tested), new `Trips/BookingImportSheet.swift`, drop handling in `MacTripWorkspace`.

#### M2-4 · Trip budget: one number, plan against actual · P0 (planned side) / P1 (actual side)

**Why:** E9, job 7. Only Wooli has the trip and the bank transactions in one private app.

**Planned side (shared with companions):**
- Costs page per trip. Hero line: "Planned **$6,420** of $8,000 budget", with points listed beside it and, if the user set point values, "Points worth ≈ $X".
- Trip budget and its currency are set here (`extras.budget`, `budgetCurrency`).
- **One currency.** Every foreign amount converts to the budget currency with the trip's rates (`extras.fxRates`). A Rates popover lists each currency used in the trip with an editable rate and "Update rates", which fetches the European Central Bank's public daily reference rates (one anonymous GET, no user data; currencies it lacks stay manual). Converted totals carry "≈". Original amounts stay on each booking.
- Breakdown by type (flights and trains, stays, food, activities) and by city, as two small bar lists using group colours. Per-person and per-day figures ("≈ $321 a day for 2"); traveller count is a stepper stored in `extras`.
- "N bookings without a price" links to Bookings filtered to them.
- Keep `TripCostsCard` in the inspector summary as the compact version of this page.

**Actual side (private to this user, P1):**
- Shown only when the Budget app is on. Section "What you've spent", with a note: "From your Budget. Only you see this."
- Link a Budget tag to the trip (pick one or create `#spain-2026`). Tagged transactions count.
- **Suggestions**, each accept / dismiss: transactions between booking date and trip end whose merchant matches a booking (airline, hotel name), transactions during the trip dates in travel, dining and transport categories, and any in a foreign currency or with a foreign location if the bank supplies it. Accepting adds the tag to the transaction; dismissing records it in `excludedTransactionIDs`.
- Planned vs. actual per type, and "Unplanned spending" for accepted transactions that match no booking.
- After the trip ends: a one-line recap on Overview and All trips: "Spain 2026 cost $7,180 · $820 under budget".

**AC**
- A trip with USD, EUR and JPY bookings shows one total in USD and the rates used.
- With the network off, totals still show using stored or manual rates.
- A companion on the shared trip sees planned costs and never sees a transaction, the tag, or actual totals (verify the trip zone's records contain none of it).
- Conversion and suggestion logic live in `Services/` with unit tests.

**Touches:** `TripModels.swift` (`TripCosts` gains conversion), new `Services/TripSpend.swift`, new `Services/ExchangeRates.swift`, new `Trips/MacTripCosts.swift`, `Models/Models.swift` (`TripSpendLink`), `Deduplicator`, privacy page.

#### M2-5 · Get the trip out · P0 (print/PDF, calendar) / P1 (file, text)

**Why:** E11, job 6.

- **Print… ⌘P and Export as PDF:** a clean day-by-day document. Cover block (trip name, dates, route), then per city and day: time, title, address, booking details (flight numbers, terminals, check-in/out, confirmation codes), notes. Options: include costs (off by default), include notes, include a map per city, paper size. No app chrome, no open slots.
- **Add to Calendar:** exports flights, trains, stays (all-day span) and anything with a time as an `.ics` file, with correct time zones from the legs (M3-1; until then, floating times). A file rather than EventKit access, so no calendar permission is needed and it works with any calendar app.
- **Copy Itinerary as Text** (plain and Markdown) for pasting into Messages, Notes or email.
- **Export Trip File (`.woolitrip`)**: the existing `ImportBundle` JSON with a declared UTI and document icon. Double-clicking one, or dropping it on All trips, imports it as a **new** trip with new ids (never overwriting), after a preview sheet. This is backup, a way to hand a trip to someone outside iCloud sharing, and the basis for templates.
- Share button in the toolbar offers: Invite People (iCloud), PDF, Calendar File, Trip File, Copy as Text.

**AC**
- The PDF of the Japan + Seoul trip is readable in grayscale, breaks pages between days sensibly, and contains every confirmation code.
- The `.ics` imports into Apple Calendar with flights at the right local times in both the departure and arrival zones.
- Export then import of a `.woolitrip` gives an identical trip (ids aside): round-trip unit test.

**Touches:** new `Trips/TripExport.swift` (pure builders for text, Markdown, ICS, bundle; tested), new `Trips/TripPrintView.swift`, `Info.plist` (exported type declaration), `WooliApp.swift` (`onOpenURL`).

### Release M3 — A plan that checks itself

#### M3-1 · Time zones · P0

- Each leg has a time zone (6.1). Plan times are local to the plan's city, as now, but the app finally knows which zone that is.
- Day headers show the zone when it differs from the previous city or from home: "Sun 27 Dec · Seville · CET (+6 h from home)".
- Flight tickets already compute duration across zones from airports; make arrival day and time consistent with the arrival leg's zone and flag a mismatch.
- During the trip, "today" and the NOW pill use the current leg's zone, not the Mac's.
- `.ics` export uses real zones.

**AC:** unit tests for a westbound date-line flight, an overnight flight, and a trip viewed from a different zone than the one it's in.

#### M3-2 · Travel time between stops · P0

- Between consecutive plans with places on the same day, a connector line shows the estimate: "14 min walk", "22 min by transit", "35 min drive". Mode is picked by distance (under 1.5 km walk; otherwise transit where Apple has it, else drive) and can be changed per connector by clicking it.
- Estimates come from `MKDirections` ETA requests, cached on disk by place pair and mode, fetched lazily for visible days only, and rate-limited. Offline or failed: fall back to straight-line distance ("2.1 km").
- Day header sums it: "4 stops · 1 h 10 min getting around".
- The Calendar view doesn't show connectors.

**AC:** opening a 30-day trip makes no more than one directions request per visible connector and none on reopen; no request fires while scrolling fast.

#### M3-3 · Tidy a day · P1

- Day header menu → **Order by Shortest Route**: reorders that day's untimed, placed plans to shorten total travel, starting from the day's stay (or the first plan). Plans with a time, and travel and stays, don't move. One undo step. Shows the saving first: "Saves about 40 min. Reorder?"
- Pure function over coordinates (nearest neighbour, then 2-opt), unit-tested.

#### M3-4 · Conflicts and warnings · P0

A plan can carry a small amber warning mark with a one-line reason; the Overview and the Planning card count them. Rules (all pure, in `Services/TripChecks.swift`, each unit-tested):

| Check | Example |
|---|---|
| Plan far from its day's city | An Activity pinned in Madrid on a Seville day (over 80 km from the leg centre, and not a travel plan) |
| Overlapping fixed times | Two plans with start and end times that overlap |
| Arrive after you leave | A flight that lands after the next booked departure |
| Stay dates don't match the city | Check-out after the city's last day; gap or overlap between consecutive stays |
| Booking outside the trip | A plan dated before the first or after the last day |
| Tight connection | Under 90 min between a flight's arrival and the next flight or train |
| No way there | Consecutive cities with no travel plan on the change day (already in coverage; show it here too) |

Each warning offers a fix where one is obvious ("Move to Madrid's day", "Extend Seville by a night") and **Ignore**, stored per plan in `extras` so it stays ignored for everyone.

**AC:** zero warnings on a clean trip; the China trip's known gaps (nights without a bed, unbooked travel days) all appear; ignoring one syncs.

#### M3-5 · Trip Overview · P0

The Overview page becomes the trip's dashboard, answering "what do I do next?":

1. **Hero** (the page's one ticket): route, dates, countdown or "Day 4 of 11 · Seville", people on the trip.
2. **To do**: a short generated list, most urgent first: nights without a bed, unbooked travel days, warnings from M3-4, bookings without a price, days with nothing planned, ideas not yet scheduled ("12 ideas waiting"). Each row is a click to the place that fixes it.
3. **Planning** card (existing heatmap), **Costs** summary, **Weather** (M3-6).
4. **Route**: the cities in order with nights, and the travel between them as small tickets; drag to reorder cities (same rules as Edit Trip).
5. **Notes**: the trip's free-text notes, editable in place.

**AC:** every To do row navigates to and selects the thing it describes; a fully planned trip shows "Nothing left to plan" instead of an empty list.

#### M3-6 · Weather · P1

- WeatherKit daily forecast per city for trip days within the forecast range: symbol, high and low on day headers and the Overview. Beyond the range, show the typical high and low for that city and week if WeatherKit's historical statistics cover it in the current SDK (**verify in the SDK before building; if not available, show nothing rather than a guess**).
- Needs the WeatherKit capability on the App ID and the required Apple Weather attribution and link wherever weather shows.
- One request per city per six hours, cached. Coordinates only are sent to Apple; add to the privacy page.

### Release M4 — Reasons to come back

| ID | Item | Pri | Notes |
|---|---|---|---|
| M4-1 | **Places you've been.** All trips gets a globe (`TripGlobe` exists) with every past trip's route, and counts: countries, cities, nights away, flights. | P1 | Uses `countryCode` from 6.1. One postcard-style recap per finished trip. |
| M4-2 | **Checklist** per trip (packing, visas, to book): groups, check off, shared with companions. | P1 | `extras.checklist`. "Start from my last trip's list" copies titles. |
| M4-3 | **Attachments** on bookings: tickets, PDFs, screenshots. Drop on a plan; Quick Look with Space. | P1 | New `TripAttachment` record type with a `CKAsset` in the trip's zone (schema deploy). Counts against the owner's iCloud. Cap 20 MB per file. The original of an M2-3 import can be attached automatically. |
| M4-4 | **Duplicate trip / save as template.** | P2 | Copies cities, ideas and untimed plans; drops dates-specific bookings and costs. |
| M4-5 | **Spotlight and Handoff.** Trips and plans in Spotlight; the open trip hands off to the iPhone. | P2 | `CSSearchableItem`, `NSUserActivity`. Local index only. |
| M4-6 | **Menu bar extra during a trip**: next plan, time and travel time. | P2 | Off by default. |
| M4-7 | **"Plan with Claude" entry point**: a toolbar item, shown when the MCP server has been set up, that copies a ready prompt for the open trip ("Help me plan Seville, Dec 27–29…") and opens Claude. | P2 | No API calls from Wooli. |

---

## 8. Cross-cutting requirements

**Sharing and concurrency.** Every feature must behave when a companion edits at the same time: the inspector's merge-onto-latest rule stays; undo never undoes someone else's change; `extras` is merged key by key on conflict, not replaced whole (two people setting different keys both win).

**iPhone.** Code is shared and work is Mac-first. Anything touching shared views goes into the iOS harmonization log in `BACKLOG.md` with what to check. The iPhone must keep opening every trip the Mac writes. Items the iPhone should get in its own pass, in priority order: open slots (M1-5), city search in trip setup (M1-4), booking status (M2-1), paste a confirmation (M2-3, also via the share extension), warnings (M3-4), travel-time connectors (M3-2).

**Claude (MCP).** `wooli_trips` returns status, time zone, warnings and converted totals as they ship; `wooli_edit_trip` can set status, end time and URL. Edits from Claude still go through the import file and are never on the undo stack.

**Accessibility.** Full keyboard access, VoiceOver labels on every control and row, no information by colour alone (status has a word or a shape), Dynamic Type-style scaling respected where macOS provides it, Reduce Motion respected for map and scroll animations.

**Performance budgets.** Trip opens in under 300 ms; typing in quick add shows suggestions within 200 ms of a pause; no main-thread work over 16 ms while scrolling the plan; app launch to All trips under 1.5 s warm.

**Offline.** Everything except place search, directions, weather and rate updates works offline, and each of those degrades with a quiet note, never an error dialog.

**Tests.** Pure logic gets unit tests in `WooliTests/` (quick-add parser, trip setup dates, open slots, undo snapshots, booking import, conversion, spend suggestions, ICS, checks, route tidy). `npm run check` is the website's gate; the app's gate is the Mac and iOS builds plus the test target.

---

## 9. App Store launch checklist (Mac)

**Blocking**
- [ ] CloudKit schema deployed to Production (6.6), then a Release build verified to sync a priced, dragged, status-marked plan between two Apple IDs.
- [ ] Mac listing: name, subtitle, description rewritten to lead with Trips; "iPhone" wording replaced where it now means both. Update `AppStore/listing.md` with a Mac section.
- [ ] Mac screenshots (2880 × 1800 or 2560 × 1600), at least: plan + map, Calendar, Bookings, Costs, All trips, Budget dashboard. Made from the sample trip and sample budget data, never real data.
- [ ] Category: the target is set to Finance. **Recommendation:** keep Finance primary for the iPhone listing, and decide with the user whether the Mac launch should lead with Travel (see open question 2). One app record means one primary category for both.
- [ ] Privacy: the "Data Not Collected" label must be re-checked against what the app now sends to third parties (Google Places search text, TMDB queries, Apple Maps, WeatherKit, ECB rates). Google Places becomes opt-in (M1-10). Update `/privacy` and the App Privacy answers in the same release. If the label can't honestly stay "Data Not Collected", change the label, not the wording.
- [ ] Sandbox: confirm the `--mcp` server and the "Add to Claude" extension work from an App Store-signed, sandboxed build (the executable is launched by another app). If not, hide the Claude settings in the App Store build rather than ship a broken button. Describe it in the review notes either way.
- [ ] SimpleFIN: it's a paid third-party service that unlocks bank sync. Keep it optional, don't sell it or link to its purchase page from inside the app if review objects, and keep the review notes' "how to test without a bank" path. Trips needs none of it.
- [ ] Review notes updated: no sign-in; sample trip path; iCloud sharing needs two Apple IDs to test; what the on-device model is used for.
- [ ] Export compliance (standard encryption only), age rating unchanged, copyright year.

**Quality**
- [ ] Fresh macOS user account run-through with no iCloud, then with iCloud (M1-9 AC).
- [ ] Dark mode, Increase Contrast, VoiceOver, keyboard-only pass on every Trips screen.
- [ ] Window sizes: minimum, a 13-inch laptop, an external display, full screen, Split View.
- [ ] Upgrade path: a user with trips from the current build opens the new build; nothing is lost; placeholders are hidden, not deleted.
- [ ] Old iPhone build + new Mac build on one shared trip for a day of edits.
- [ ] `/support` gains Mac answers: keyboard shortcuts, importing a confirmation, sharing a trip, exporting.

---

## 10. Test script for G1 (run before M1 ships)

Give five people who haven't seen Wooli a Mac with a fresh install and this card. Time each step; don't help.

1. Open Wooli. You're planning a trip to Portugal next spring: three nights in Lisbon, two in Porto. Set it up.
2. Add these to your Lisbon days: Time Out Market, Belém Tower, Pastéis de Belém, Castelo de São Jorge, a restaurant of your choice.
3. You decide Belém Tower fits better on your last Lisbon day. Move it.
4. You deleted the castle by mistake. Get it back.
5. Add a place you'd like to see but haven't decided when.
6. Find where on the map your second day's stops are.

Pass: median total under five minutes, and no step where more than one of five gets stuck for over 30 seconds.

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Schema deploy missed or done late; saves fail for every user | Medium | 6.6 is the first M1 task and the first checklist line; the `extras` field means it happens once. |
| Hiding placeholders confuses the companion still on an old iPhone build who sees them | Medium | Ship the iPhone harmonization of M1-5 in the same TestFlight cycle. |
| On-device model unavailable (older Macs, region, language) | High | Deterministic parser is the baseline; the model is an upgrade. Review sheet is always shown. |
| Undo interacts badly with sync (undoing over a companion's newer edit) | Medium | Undo applies the old value only to the fields the action changed, merged onto the latest record. |
| Scope: M1 is large | High | P0s in M1 are 1, 2, 3, 4, 5, 6, 7 (menus), 9, 10. If it must shrink, ship 3, 4, 5, 6, 9, 10 first; 1, 2 and 7 can follow a week later without blocking review. |
| Privacy label change weakens the pitch | Low | Opt-in for Google keeps the default path free of third-party search; state plainly what each optional feature sends. |
| A trip planner under a Finance category is hard to find | Medium | Open question 2. |

---

## 12. Decisions (were open questions)

**Decided 2026-11-12: the user accepted every default below.** Build to the defaults; the questions are kept for context.

1. **Price.** Free at launch, or paid? *Default: free, no in-app purchase, revisit after 1,000 installs.* A paid tier later would need StoreKit and a decision on what's in it.
2. **Category and subtitle.** Lead the listing with Travel ("Trips, budget & places to eat") or keep Finance first? *Default: keep Finance primary, Travel secondary, but rewrite the subtitle and first screenshot to lead with Trips on the Mac.*
3. **Shell.** This PRD keeps the Apps popover you chose on 2026-11-12 and gives Trips its own sidebar. Happy with that, or do you want one unified sidebar for all apps? *Default: as written.*
4. **Existing meal placeholders.** Hide and leave them (as written), or delete them from your three trips once both of you are on the new build? *Default: hide; you can run "Remove empty meal slots" per trip.*
5. **Exchange rates from the ECB.** One anonymous request to a public endpoint, covering about 30 currencies. OK, or manual rates only? *Default: allow, with manual override.*
6. **Week start and "home".** Is New York the right default home city for your own trips, and should the home city sync between your devices? *Default: stored per device.*

---

## 13. Build order

One item per commit series, in this order. Later items assume earlier ones.

1. Data model: leg fields, `extras` on both records, status with fallback, tests. Deploy schema to Development. (section 6)
2. M1-5 open slots (stops the placeholder problem at the source; smallest visible win).
3. M1-4 new trip sheet with city search.
4. M1-3 quick add.
5. M1-6 undo.
6. M1-2 layout, then M1-1 sidebar (both reshape `MacTripWorkspace`; do them back to back).
7. M1-7 menus, then the palette.
8. M1-8 gallery, M1-9 first run, M1-10 readiness. **Ship M1.**
9. M2-1 status → M2-2 Bookings → M2-3 import → M2-5 export → M2-4 costs. **Ship M2.**
10. M3-1 time zones → M3-4 checks → M3-2 travel times → M3-5 Overview → M3-3 tidy → M3-6 weather. **Ship M3.**
11. M4 by priority.
