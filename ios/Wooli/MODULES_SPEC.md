> **2026-10-11:** the Mood module was removed at the user's request. Mood sections below are historical; Period remains.

# Modules spec — Period & Mood (built-in mini apps)

Owner request (2026-09-27): add WeChat-style "mini apps" to Wooli iOS, built as
**native, opt-in modules inside the app** — not downloaded code. First two:
**Period** and **Mood**. Everything stays on-device (SwiftData + the user's
private iCloud), same as the budget. No server, no new accounts.

Design context: https://claude.ai/artifact/QzNkWRS4pKPWKWDcF1ENZK (Wooli iOS
Direction — modules surface as Home cards, per the "Edit Home" screen).

Ship in phases. **Build Phase 1 now**; Phases 2–3 are for later cycles (add
them to `BACKLOG.md`).

---

## Phase 1 — module framework + Period + Mood

### 1. Module framework

- New folder `Wooli/Modules/` with `ModuleRegistry.swift`, `Period/`, `Mood/`.
- Module code must not import budget types (`LocalTransaction`, `BudgetCategory`,
  `Ledger`…). Keep it self-contained so it can move into a Swift package or a
  standalone app later.
- `enum WooliModule: String, CaseIterable, Identifiable { case period, mood }`
  with `title`, `systemImage`, `summary` (one line for Settings).
- Enabled state per module: `@AppStorage("module.<id>.enabled")`, **default off**.
  A user who never turns one on sees no change anywhere.
- Per-module privacy settings, also `@AppStorage`:
  - `module.<id>.showOnHome` (default on once enabled)
  - `module.<id>.requireFaceID` (default off)

### 2. Settings → Modules

- New section in `SettingsView.swift`: **Modules** → a `NavigationLink` to
  `ModulesSettingsView`.
- One row per module: icon, title, summary, toggle. When enabled, reveal
  "Show on Home" and "Require Face ID" toggles.
- Turning a module off hides it; it does **not** delete data. Add a separate
  destructive "Delete all Period data" / "Delete all Mood data" button with an
  in-app confirmation.

### 3. Access

- **Home cards.** For each enabled module with `showOnHome`, add its card to
  `DashboardView` after `ReviewPreviewCard` (before `BudgetSummaryCard`).
  When the planned Edit Home / `DashboardCard` work lands, these become
  `DashboardCard` cases like the others.
- Tapping a card pushes the module's full screen (`NavigationLink` inside the
  existing `NavigationStack`). **No new tab** — the tab bar stays at five.
- **Face ID lock** (when `requireFaceID`): the full screen shows a locked
  placeholder until `LAContext.evaluatePolicy(.deviceOwnerAuthentication…)`
  succeeds; re-lock when the app goes to background. Add
  `NSFaceIDUsageDescription` to Info.plist. When locked, the Home card shows only
  the module name and a lock icon — no cycle day, no mood.

### 4. Period module

**Model** (CloudKit rules as in `Models.swift`: every property has a default, no
`@Attribute(.unique)`, optional relationships only):

```swift
@Model final class PeriodEntry {
    var id: String = UUID().uuidString
    var startDay: Date = Date.now      // start of day, local calendar
    var endDay: Date?                  // nil = ongoing
    var flowRaw: String = ""           // "", "light", "medium", "heavy"
    var symptoms: [String] = []
    var note: String = ""
    var updatedAt: Date = Date.now
}
```

**Logic** — port `lib/period-utils.ts` from the web repo into
`Modules/Period/CycleMath.swift` (pure functions, no SwiftData):

- `averageCycleLength` — mean of gaps between the last 7 starts; default 28.
- `averagePeriodLength` — mean of completed entries (inclusive days); default 5.
- `predictedNextStart` — latest start + average cycle.
- `cycleDay(today:)` — days since latest start + 1.
- `isPeriodDay`, `isPredictedDay` — predictions only when ≥ 2 entries.
- Symptom list: cramps, headache, fatigue, bloating, mood swings, nausea,
  breast tenderness, acne. Flow colors: light `#fda4af`, medium `#ef4444`,
  heavy `#991b1b`.
- **Fix while porting:** the web version compares dates via `toISOString()`
  (UTC), which is off by one day in US evenings. Use
  `Calendar.current.startOfDay` / `dateComponents([.day])` everywhere.

**Screens**
- **Home card:** "Day 12" + "Next period in about 16 days" (or "Period day 2",
  or "Log your first period" when empty), small cycle ring. Quick action
  button: "Period started" / "Period ended".
- **PeriodView (full screen):** month calendar grid — logged days filled with
  flow color, predicted days outlined/dashed, today ringed; month paging.
  Below: stats (average cycle, average period, next predicted start), then
  history list. "Log period" button.
- **PeriodEntryEditor (sheet):** start/end date, flow picker, symptom chips,
  note. Delete with in-app confirmation.

### 5. Mood module

**Model:**

```swift
@Model final class MoodEntry {
    var id: String = UUID().uuidString
    var day: Date = Date.now           // start of day; one entry per day
    var score: Int = 3                 // 1 awful … 5 great
    var tags: [String] = []            // e.g. "sleep", "work", "exercise"
    var note: String = ""
    var updatedAt: Date = Date.now
}
```

- One entry per day: logging again on the same day updates that entry.
- Scale: 1 😞 awful, 2 🙁 bad, 3 😐 okay, 4 🙂 good, 5 😄 great.
- Default tags: sleep, work, exercise, social, family, health, money, weather.
  Users can add their own.

**Screens**
- **Home card:** "How are you today?" + five emoji buttons; tapping one logs
  immediately (`.sensoryFeedback(.success)`), then the card shows the logged
  mood + "Add note". Show a 7-day strip of dots below.
- **MoodView (full screen):** 30-day line/dot chart (Swift Charts), month
  calendar colored by score, most common tags on good vs. bad days (simple
  counts, no AI needed), history list.
- **MoodEntryEditor (sheet):** score, tags, note.

### 6. Sync & dedupe

- Add `PeriodEntry` and `MoodEntry` to the `Schema` in `WooliApp.swift`.
- Extend `Deduplicator.run`: `PeriodEntry` keyed by `startDay`,
  `MoodEntry` keyed by `day`; keep the copy with the latest `updatedAt`.

### 7. Sample data & debug

- `SampleData`: when modules are enabled in sample mode, seed 6 months of
  periods (cycle 27–30 days, 4–6 days long) and ~40 mood entries.
- Debug launch args: `-module period` / `-module mood` enables that module and
  pushes its screen (alongside the existing `-sampleData`, `-tab`).
- Add `CycleMath` cases to `DebugSelfTest` (or unit tests if a test target
  exists — backlog #7): averages, prediction with 0/1/2+ entries, ongoing
  period, the late-evening date case.

### Acceptance

- Fresh install: no module UI anywhere until enabled in Settings → Modules.
- Enable Period in sample mode → Home card shows cycle day + next prediction;
  calendar shows logged and predicted days that agree with `CycleMath`.
- Log a mood from the Home card in one tap; logging again the same day replaces it.
- Face ID on → Home card hides details; full screen requires auth; re-locks on background.
- Turn a module off → UI disappears, data remains; turn on → it's back.
- Builds clean; existing budget screens unchanged except the new Home cards.

---

## Phase 2 — Calendar predictions (Period)

- Off by default: "Show predictions in Calendar" in Period settings.
- EventKit **full access** (`NSCalendarsFullAccessUsageDescription`). Create a
  dedicated calendar (user-named, default "Cycle") on a source the user picks —
  default iCloud or On My iPhone; never auto-pick Exchange/Google/shared.
- Events: all-day, availability **free**, discreet user-chosen title (default
  "🌸 (predicted)"). Store created event identifiers; on every prediction change,
  delete ours and rewrite. Replace predictions with actual dates once logged.
- Turning it off deletes the Wooli calendar (after in-app confirmation).
- Optional: write logged periods to HealthKit (menstrual flow) as a separate toggle.

## Phase 3 — Quick logging outside the app

- Widget extension with an **App Group** so the widget can read/write the
  SwiftData store.
- Interactive mood widget (five buttons via `AppIntent`), period status widget
  (Lock Screen versions show no cycle details — "Log mood" / "Cycle" only).
- Control Center control "Log mood"; App Intents for Siri/Shortcuts
  ("Log my mood as good", "When is my next period?").
- Optional daily mood reminder notification with action buttons.
