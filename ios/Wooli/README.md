# Wooli (iPhone, local-only)

A minimal, single-user iPhone app for the Budget module: it stores accounts
and transactions on-device only (SwiftData) and syncs them by talking
directly to your bank's SimpleFIN bridge, using a SimpleFIN token you
provide yourself. There is no Wooli server involved in this app at all —
no Supabase, no API routes, no account creation.

This is a deliberately separate, scoped-down slice of the Budget module
(accounts + transactions only — no categories, budgets, goals, or
AI categorization). See `docs/PRODUCT-DIRECTION.md` in the main repo:
a real mobile app was already called out as "a separate product."

## Status: source only, not build-verified

The container this was written in has no Xcode or Swift toolchain, so
none of this has been compiled, run in the Simulator, or tested on a
device. Treat it as a strong first draft, not a working build — you'll
likely need to fix small SwiftData/SwiftUI API mismatches once it's
actually compiled (these change often between iOS/Xcode versions).

## Requirements

- Xcode 15+ on a Mac
- iOS 17+ deployment target (uses SwiftData, `@Query`, `#Predicate`)
- A SimpleFIN setup token from https://simplefin.org (or your bridge's
  equivalent) — a one-time-use base64 token you get after linking your
  bank(s) at the bridge.

## Setup (creates a correct Xcode project, then drops these files in)

Xcode's own "New Project" wizard generates a guaranteed-valid project
file — much safer than a hand-written one, so:

1. In Xcode: **File → New → Project → iOS → App**
2. Product Name: `Wooli`, Interface: **SwiftUI**, Language: **Swift**
3. Uncheck "Use Core Data" and "Include Tests" (not needed)
4. Save it anywhere — e.g. as a sibling of this `ios/Wooli/` folder, or
   right on top of it
5. In the new project's `Wooli` group, **delete** the auto-generated
   `ContentView.swift` and the `@main` App file Xcode created
6. Drag every file under this `Sources/` folder into the Xcode project
   navigator (check "Copy items if needed" and add to the `Wooli` target),
   keeping the folder groups (`Models`, `SimpleFin`, `Services`, `Views`)
7. Project settings → General → Minimum Deployments → **iOS 17.0**
8. Build (⌘B). Fix whatever the compiler flags — SwiftData/SwiftUI APIs
   shift slightly release to release, so expect a handful of small fixes.
9. Run on Simulator or a real device (⌘R)

## How it works

- `Sources/SimpleFin/SimpleFinClient.swift` — direct port of the web app's
  `lib/budget/simplefin-client.ts`: claims a setup token for a long-lived
  access URL, then fetches accounts/transactions from that bridge.
- `Sources/Services/KeychainHelper.swift` — the access URL contains bank
  credentials, so it's stored in the iOS Keychain, never in SwiftData or
  UserDefaults.
- `Sources/Services/SyncService.swift` — claims the token once, then on
  each sync fetches the last 90 days and upserts into SwiftData by
  provider id (same dedup key as the web app's `provider_transaction_id`).
- `Sources/Models/LocalModels.swift` — `LocalAccount` / `LocalTransaction`,
  the on-device SwiftData store. Nothing here ever leaves the phone.
- `Sources/Views/` — Connect screen (paste token) → Accounts list →
  Transactions per account, with a manual refresh button.

## Known gaps (by design, given the "Budget/SimpleFIN only" scope)

- No categories, budgets, goals, net worth, or recurring rules
- No AI categorization (that's server-side Groq in the web app)
- Single SimpleFIN connection at a time (matches the SimpleFIN model:
  one token's access URL can already cover multiple linked banks)
- No CSV import
