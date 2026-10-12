# Wooli iOS — Shared Roadmap & Backlog

**One file, shared by every AI agent (Claude, Gemini, Xcode assistant) and the user.**
Read this before starting any iOS work. Update it in the same commit as the work.

---

## How agents work together (read first)

1. **Pick from the top.** Take the first unclaimed item in the current phase. Don't reorder priorities — the user does that.
2. **Claim it.** Change its status to `🔨 in progress — <agent>, <YYYY-MM-DD>` and commit that line before writing code, so another agent doesn't start the same item.
3. **One item per commit** (or a small series), message prefixed `iOS:`. Name the item ID, e.g. `iOS: O2 household filter includes shared accounts`.
4. **Must build before commit:**
   ```
   cd ios/Wooli && xcodebuild -scheme Wooli -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build
   ```
   No new warnings. Check it in the Simulator with `-sampleData` (launch arg) when UI changed.
5. **Finish it.** Move the item to **Done** with one line: what shipped, which agent, date, anything not verified.
6. **Found something out of scope?** Add it to **Inbox** at the bottom — don't fix it in the same change.
7. **Product decisions** go to **Decisions** with the date. If a spec here is unclear, ask the user rather than guessing.

### Ground rules for the codebase
- Everything stays on-device: SimpleFIN → phone, SwiftData + the user's own iCloud (CloudKit). No servers.
- CloudKit model rules (see `Models/Models.swift`): every stored property has a default, no `@Attribute(.unique)`, no required relationships, links are string ids. New models must be added to the `Schema` in `WooliApp.swift` and to `Deduplicator` if they can be duplicated across devices.
- Pure calculation goes in `Services/` (testable, no SwiftUI); views stay thin.
- Match existing style: small comments that explain *why*, `Theme` colors, `.card()` containers, `Ledger` for hidden-account / category lookups.
- Don't leave stray blank lines or re-indented modifiers in files you didn't mean to change.

### Release checklist (TestFlight / App Store)
1. **CloudKit schema:** if this release adds or changes synced fields (trip fields, new record types), open the CloudKit Console → `iCloud.com.timothyeng.wooli` → **Deploy Schema Changes** to Production *before* the build goes out. Otherwise saves of that data fail for every user.
2. Bump the build number (Xcode Cloud does this automatically).
3. Don't mix Xcode-installed and TestFlight builds on the same phone for trip testing: they use different CloudKit environments (development vs production). The app re-uploads owned trips when it notices a switch (`TripStore.moveToNewEnvironment`) and backs up `trips.json` before clearing anything, but shared trips need a fresh invite.

---

## Product direction

Copilot's feel + Monarch's depth (brief: https://claude.ai/artifact/QzNkWRS4pKPWKWDcF1ENZK).
**Goal for this stretch:** make Wooli genuinely useful week to week — help people *understand* their spending patterns, not just log them.

---

## Phase 0 — Optimize before new features  ← **current phase**

From a code + UX review on 2026-10-11 (Claude), after a run of changes from several agents.
Ordered by priority.

| ID | Item | Status |
|----|------|--------|
| O1 | History retention vs. Reports (decision needed — see below) | ⏳ waiting on user |
| O2 | Household / People filter fixes | todo |
| O3 | Navigation clean-up (duplicate entry points) | todo |
| O4 | Add a unit-test target for the money math | todo |
| O5 | Dashboard / Reports performance | todo |
| O6 | Code hygiene from recent edits | todo |
| O7 | Starter rules sanity check | todo |
| O8 | Sample data goes stale after a month rolls over | ✅ done |
| O9 | Slow first launch | 🟡 launch screen fixed; verify on device |
| O10 | Onboarding polish | ✅ done (tour visuals = idea) |

**O1 — History retention vs. Reports.** Since `7120327` the app deletes every transaction older than the start of last month (`ReviewWindow.pruneOlderTransactions`, run on launch and after each sync). But Reports still offers "Last 3 months", "Last 6 months", "This year", and the Cash flow card always draws 6 months — those show only ~2 months of data, which looks broken. The `ReviewWindow` doc comment even says older data "stays in the store for charts and reports" — it doesn't. This also blocks month-over-month insights (F1, F2).
Options:
- **A (recommended):** keep the 2-month raw window for review/lists, but before pruning, roll each finished week/month into a small `PeriodSummary` model (spend by category, income, transaction count, top ~10 largest transactions). Reports and insights read summaries for older periods. Small store, keeps history forever.
- **B:** keep raw transactions longer (e.g. 13 months). Simplest code; bigger iCloud store. SimpleFIN only gives ~90 days back, so history builds up from now either way.
- **C:** keep 2 months and remove the longer Reports periods.

**O2 — Household / People filter** (added by Gemini in `343f828`).
- Picking a person on Dashboard/Reports hides accounts set to "Everyone" (ownerId nil). Shared accounts should count for everyone, or the picker needs a "Shared" option.
- Net Worth card ignores the person filter while every other card respects it.
- Label mismatch: Dashboard says "Household", Reports says "Everyone".
- `Person` isn't erased in `AppModel.eraseLocalData` and isn't deduplicated in `Deduplicator`.
- `PersonEditView` only saves on `onDisappear` — no explicit Save, easy to lose an edit.

**O3 — Navigation clean-up.** Settings opens from both the Dashboard gear and Menu; Rules is in both Settings and Menu; Settings is a sheet while its siblings push. Pick one home for each (suggest: Menu owns Budget/Categories/Rules/Recurring/People/Settings; drop the Dashboard gear). Replace `MenuView`'s string routes with an enum.

**O4 — Unit tests.** There's no iOS test target. Add one for the pure logic: `BudgetMath`/`BudgetPlan`, `cumulativeSpending`, `RuleEngine` (match + consolidate), `RecurringDetector`, `Cadence.next`/`previous`, `SpendingPace`, `CycleMath` (move `CycleMath.selfTest` into it). New insight math (F1/F2) must ship with tests.

**O5 — Performance.** Dashboard and Reports `@Query` all transactions and every card re-filters / re-summarizes them on every render (`Ledger`, `MonthSummary`, `cumulativeSpending` computed several times). Compute once per body and pass down. `InstitutionLogo` JSON-decodes the custom-logo map from UserDefaults for every row it draws — decode once.

**O6 — Code hygiene.**
- Stray blank lines and mis-indented `.navigationTitle` in `AccountsView`, `RulesView` (4 spots), `TransactionsView` (5 spots).
- Double `Divider()` in `AccountDetailView` after "Assigned To".
- Build warning: unused `withAnimation` result at `TransactionsView.swift:156`.
- `TextListConditionEditor` uses `ForEach(values.indices, id: \.self)` with editable text fields — deleting a row can make fields show the wrong value; give values stable ids.
- Console: "Custom UnitPoint values are not supported in AxisValueLabel's anchor" — find the chart and use a standard anchor.

**O7 — Starter rules** (`DefaultCategories.starterRules`, injected for existing users). "contains" matches are broad: `amazon` → Shopping also catches AWS / Prime Video; `target` matches any merchant containing "target"; `uber ` and `uber eats` both match Uber Eats — confirm which wins in `RuleEngine` order. Tighten or switch some to exact.

**O8 — Stale sample data.** ✅ `SampleData.rollForward` shifts sample records forward by the days since they were loaded, keeping any edits. It runs on launch in sample mode, and older sessions without a stored date work too.

**O9 — Slow first launch.** Measured 2026-10-11: on a fresh debug install on the Simulator, ~4.6 s pass before any Wooli code runs. After that the app's own startup takes ~1.6 s, and the startup passes in `RootView.task` take ~35 ms. A warm launch reaches first frame in ~0.2 s, and taps respond instantly. ✅ The launch screen was Xcode's blank white; it's now brand blue (`LaunchBackground` color), so launch flows into the welcome card. **Left:** time a Release build on a real iPhone. iOS caches launch screens, so an updated install may show white until the phone restarts.

**O10 — Onboarding polish.** ✅ The Budget tour page's category row was a horizontal scroll that the tour's page lock froze (users could only see 2½ groups, with "Transportation" cut off). It's now a grid showing all spending groups. ✅ The card no longer jumps on the last page: the bottom button stays in place and becomes "Connect with SimpleFIN", with "Explore with sample data" above it. *Idea, not scheduled:* swap the text-only tour pages for real screenshots of each tab.

**How to test the new-user flow** (Simulator): delete the app, run `xcrun simctl keychain booted reset` (the SimpleFIN key survives app deletion), reinstall, launch. The "Transactions Loaded" screen normally only appears after a real bank connect — launch with `-sampleData -calibration` to see it. Don't test onboarding on a phone that holds real data: choosing sample data there would mix sample transactions into the real store.

---

## Phase 1 — Understand your spending (next features)

### F1 — Largest transactions by week / month  (size M)
**Why:** the fastest "where did my money go?" answer. Today it's only reachable by opening Transactions → Filters → Sort by amount.
**Build:**
- Reports card **"Biggest purchases"**: segmented `Week | Month`, a `‹ Oct 6–12 ›` stepper to move between periods, top 5 with merchant, category tile, date, amount; "See all" opens Transactions pre-filtered to that period and sorted largest first.
- Spending only: exclude income, transfers, hidden transactions/accounts, split originals (use split parts).
- Toggle **"One-offs only"** that hides recurring items (rent, bills) so the list isn't always rent first — match against `RecurringItem.merchant`.
- Show what share of the period's spending the top 5 make up ("Top 5 = 46% of this week").
- Dashboard: optional compact version (top 3 this week) — behind the dashboard ordering, not by default.
**Depends on:** O1 for anything older than last month.

### F2 — Weekly spending insights ("Your week")  (size L)
**Why:** turns data into habits people can act on. Weekly is the right rhythm — monthly is too slow to change behavior.
**Build (ship in slices, each useful on its own):**
1. **Week in Review screen** (Mon–Sun, opens from a Dashboard card): total spent vs. your 4-week average (↑/↓ %), spend by category with the biggest movers ("Dining +$84 vs. usual"), biggest purchases (reuse F1), new merchants this week, recurring charges that hit.
2. **Pattern cards** — plain-language, one number each, only shown when the signal is real (minimum data + meaningful difference):
   - Day of week: "You spend most on Saturdays — avg $142 vs. $61 on weekdays." (7-bar chart)
   - Weekend vs. weekday share.
   - Frequency: "Coffee 9× this week ($47) — usually 5×."
   - Small purchases add up: "38 purchases under $15 = $312 this month."
   - After payday: spending in the 3 days after income lands vs. the rest.
3. **Weekly nudge:** optional local notification Sunday evening "Your week: $612 spent, $90 under your usual" → opens Week in Review. Off by default; toggle in Settings.
**Math lives in** a new `Services/SpendingInsights.swift` (pure functions over transactions/summaries + `Ledger`), with unit tests (O4).
**Data:** 2-month window gives ~5–9 weeks of baseline — enough for slices 1–2; longer trends need O1.
**Open questions for the user:** week starts Monday or Sunday? Should insights respect the Household person picker?

---

## Phase T — Shared trips (planned 2026-10-11, waiting on user decisions)

**Goal:** plan trips in Wooli and co-create the itinerary with someone on another Apple ID (e.g. send your partner a link in Messages, they join and edit). Built on Apple Maps and other Apple frameworks.

### Backend decision: Supabase, not CloudKit
- SwiftData (the app's store) **can't share with another Apple ID** — no CKShare or shared-database support, checked in the iOS 27 SDK. CloudKit sharing would need a second Core Data stack alongside SwiftData, can only be tested on two real devices, and gives no web fallback.
- The web app already has a complete Trips module on Supabase (`docs/modules/TRIPS.md`: trips, days, sections, hotels, legs, share pages, AI export). Reusing it means existing trips appear in the app, the other person can use the web if they don't have Wooli, and Supabase Realtime gives live co-editing.
- Trips aren't financial data, so a server for trips doesn't break the "bank data stays on your phone" promise. Budget data stays on-device.
- ⚠️ **2026-10-11:** the Supabase project host (`mymqbaoxbpxciuvvxvmr.supabase.co`) doesn't resolve — paused or deleted. The user needs to restore it (or create a new project) first.

### T1 — Backend: members + invites (migration needs user approval before running)
- `trip_members (trip_id, user_id, role 'owner'|'editor', joined_at)`, unique (trip_id, user_id). Backfill an owner row for every existing trip.
- `trip_invites (token, trip_id, created_by, role, expires_at, accepted_by)`.
- `accept_trip_invite(token)` — security-definer function that adds the caller as a member.
- RLS on `trips`, `trip_days`, `trip_hotels`: allowed if the caller is a member of the trip, instead of `user_id = auth.uid()`. Keep `user_id` as "created by".
- Turn on Realtime for `trip_days` and `trip_hotels`.
- Web: `/join/[token]` page (sign in → accept → open trip). Serve `apple-app-site-association` so the same link opens the iPhone app when it's installed.
- Concurrency: sections live as one JSON array per day, so two people editing the same day at once would overwrite each other. v1: only save if the day's `updated_at` hasn't changed since loading; otherwise reload and re-apply the edit. Later, consider one row per item (`trip_items`).

### T2 — iOS: sign-in + read
- `supabase-swift` via Swift Package Manager. **Sign in with Apple** (`signInWithIdToken`), plus Google so the user's existing web account (Google/password) keeps its trips — or link Apple to that account.
- Menu → **Trips**: upcoming/past list → trip → day pager → day timeline (transit / activity / meal, with times) → day map.
- Cache the last-loaded trips on device so they open offline.

### T3 — iOS: editing with Apple Maps
- Add/edit/reorder/skip items. Place search with `MKLocalSearchCompleter`, stored as name + coordinates + Apple Maps place ID.
- Day map in MapKit: numbered pins, route between stops, travel times between stops via `MKDirections` ("12 min walk").
- Look Around preview and "Directions in Apple Maps" for each place. Hotels with check-in/check-out.
- Legacy web data stores Google Maps links — reuse `coordsFromText` logic so those still show as pins.

### T4 — iOS: sharing
- "Invite" → `ShareLink` with the universal link (Messages / AirDrop). Members list with initials. Remove a member (owner only).
- Live updates via Realtime. "Edited by Maya just now" on changed items.

### T5 — Apple extras (pick and order later)
- **WeatherKit** forecast on each day (needs the WeatherKit capability).
- **Calendar** (EventKit): add a trip's timed items to a calendar.
- **Trip spending**: link a trip to a Wooli tag (tags already exist) → spent so far vs. trip budget. On-device only; not shared.
- **Live Activity** on trip days: "Next up: Louvre at 2:00 · 14 min walk".
- **Widgets / App Intents**: "What's next on my trip?"

## Phase S — Super app (branch `ios/super-app-shell`, started 2026-10-11)

**Goal:** Wooli becomes a home for personal apps. Budget and Trips are the main apps, Period is secondary (opt-in), and more can follow (date tracker, outfit tracker).

**Shell (✅ built, Claude 2026-10-11):**
- **Today** (`Hub/TodayView.swift`) is the launch screen: one card per app (tap = open that app), then a "Your apps" grid with an Add tile (→ Settings → Apps). Budget leads because people adopt one core service first.
- **`AppSpace`** (`Hub/AppSpace.swift`) lists the apps. Each app keeps its own navigation: Budget keeps its five tabs, Trips and Period are single stacks.
- **☰ drawer = app switcher:** Apps on top (current one checked), then tools for the current app (Budget tools only in Budget), then Settings/Feedback.
- Settings → "Modules" renamed **Apps**. Optional apps still use `WooliModule` for on/off + Face ID; a locked app shows "Locked" on Today.
- Debug: `-space <today|budget|trips|period>`, `-drawer` (open the switcher), `-futureApps` (mock Dates + Outfits cards/tiles to preview growth — DEBUG only, not real features).

**Adding an app (the recipe):** a case in `AppSpace` (+ a `WooliModule` case if it's optional), a Today card in `TodayView`, its root in `SpaceRoot` (`RootView.swift`), its models in the `Schema` + `Deduplicator`. Keep app code self-contained (no budget types), same as `MODULES_SPEC.md`.

**Next (not started):**
| ID | Item | Status |
|----|------|--------|
| S1 | User tests the shell on device; decide Today vs. Budget as launch screen long-term | ⏳ waiting on user |
| S2 | Edit Today: reorder/hide cards (reuse the `DashboardLayoutStore` pattern) | todo |
| S3 | Retire the Budget dashboard's "Modules" card (Today replaces it); rename "Show on Home" | todo |
| S4 | **Dates** app — spec with user: what to track (date nights? ideas list? anniversaries?), link spend to a Budget tag | idea |
| S5 | **Outfits** app — spec with user: photo wardrobe, log what you wore, "last worn", WeatherKit suggestion | idea |
| S6 | Cross-app links: trip spend from Budget tags (T5), date-night spend | idea |
| S7 | iPad: switch the drawer to a `sidebarAdaptable` TabView with a `TabSection` per app | idea |

---

## Phase 2 — Existing backlog (carried over)

1. **Recurring in the budget** — count bills still due this month into "left to spend" (Copilot).
2. **Savings goals** — target amount/date linked to an account's balance (Monarch, YNAB).
3. **Bulk edit** — select several transactions → set category / mark reviewed / hide.
4. **Per-month planned amounts** — a month can override the default planned amount.
5. **Home-screen widget** — left to budget, next bills (could show "this week so far" after F2).
6. **Accessibility pass** — VoiceOver labels, Dynamic Type on budget rows and charts.
7. **Modules Phase 2 — Period predictions in Calendar** (see `MODULES_SPEC.md`).
8. **Modules Phase 3 — Period widget / quick logging** (see `MODULES_SPEC.md`; mood parts dropped).

---

## Decisions

- **2026-10-11** — Super app direction (branch `ios/super-app-shell`): Today hub as launch screen, ☰ drawer as app switcher, each app keeps its own navigation. Budget + Trips primary, Period secondary/opt-in.

- **2026-10-11** — Mood module removed at the user's request (code, model, sample data, self-test). Period stays. SwiftData drops the `MoodEntry` table on next launch (verified in Simulator).
- **2026-10-11** — Priority: optimize (Phase 0) before new features. Next features are F1 + F2 (spending patterns, largest transactions).
- **2026-09-26** — Keep only last month + month to date of transactions (`ReviewWindow`). Under review in O1.
- **Cycle 1** — "Analyze with Claude" export removed: not practical. Non-AI features first.

---

## Done

- **2026-10-11 · Claude** — Phase S shell: Today hub, `AppSpace`, ☰ app switcher, Trips/Period as full apps, Settings → Apps. Also fixed: the Budget tab had no navigation bar (no month arrows) because `BudgetView` has no stack of its own — the tab now wraps it. Verified in the Simulator with `-sampleData`; not yet on a device.

- **2026-10-11 · Claude** — CloudKit environment fixes after a TestFlight build (production) was installed over an Xcode build (development): sharing failed ("Zone does not exist"), the invitee saw "Trip not available", and an apparent account switch wiped all trips on the phone (restored from a backup taken minutes earlier; both trips now in production). Fixes: re-upload owned trips on environment change; ensure a trip is in iCloud before sharing; never delete trips on account change (keep on sign-out, back up before clearing on a switch).
- **2026-10-11 · Claude** — Trip page is now one card per day: the day you move holds the travel card and the new leg's header as a divider (plans before departure above, the rest below); leg color bar on each day; collapsing a leg hides its later days. Travel-only days outside legs (overnight flights) fold into the arrival card ("Wed Mar 31 → Thu Apr 1"). Flight detection recognizes flight numbers and more airport codes.
- **2026-10-11 · Claude** — Trip legs ("stops"): collapsible colored leg sections with a timeline, boarding-pass travel cards between legs (mode guessed from bookings, straight-line distance), Home cards at start/end; stops editor in Edit trip; place search biased to the day's leg. Collapsed state remembered per trip.
- **2026-10-11 · Claude** — Trips v1 on CloudKit (Menu → Plan → Trips): CKSyncEngine sync, iCloud invites, Ideas + days, Apple Maps search (kept to the destination), day map with routes and walk/drive times, day titles. Imported the web "Japan + Seoul 2026" trip onto the user's iPhone (216 items) via `Documents/trip-import.json` (`TripStore.importPendingFile`). **Not yet tested: invites between two Apple Accounts** — needs TestFlight on both phones plus the CloudKit schema deployed to Production.
- **2026-10-11 · Claude** — Spending Pace line follows a usual month instead of a straight line (`Services/SpendingPace.swift`): recurring bills on their charge days, the rest weighted by weekday habits (median per weekday, blended 50/50 with even; needs 21+ days of history, else even). Sample data: "$1,406 over pace" → "$124 under your usual pace". Not yet unit-tested — add to O4.
- **2026-10-11 · Claude** — O8 sample data rolls forward; O9 brand launch screen + startup timing; O10 Budget tour grid, fixed bottom button; `-calibration` debug launch arg.
- **2026-10-11 · Claude** — Removed Mood module; turned this file into the shared roadmap; Phase 0 review.
- **Gemini (2026-09-27)** — Household people + account owner; hide transactions per account; custom institution logos (Capital One, Bank of America); bottom Menu tab; feedback button; forced intro + "Transactions loaded" interstitial; 20 starter rules (incl. retroactive injection); editable rule text lists; auto-tidy on save. Follow-up fixes by Claude in `ee2225a`.
- **Budget rollover** — per category/group "Roll over what's left"; monthly close adds planned − spent to a carried-over balance; editable balance. Not yet verified on device.
- **Modules Phase 1 — Period** (Mood removed 2026-10-11): opt-in modules, Face ID gate, Period tracking with predictions.
- **Cycle 5 — Rules clean-up** — Rules grouped by category; "Tidy up rules".
- **Cycle 4 — Tags + rule fixes** — tags on transactions, Tags filter and report, "Add tag" rule action.
- **Cycle 3 — Split transactions + skip review per merchant.**
- **Cycle 2 — Recurring bills & subscriptions** — detection, Recurring screen, editor, Dashboard card.
- **Cycle 1 — Analyze with Claude** — shipped, then removed.

---

## Inbox (found while working — not yet prioritized)

- _empty_
