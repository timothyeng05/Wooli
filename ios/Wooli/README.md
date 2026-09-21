# Wooli (iPhone, local-first)

A minimal, single-user iPhone app for the Budget module: accounts and
transactions live in SwiftData, synced across the user's own devices via
their own private iCloud (CloudKit) — never a Wooli-run database — and
bank data comes in by talking directly to the user's bank's SimpleFIN
bridge, using a SimpleFIN token they provide themselves. There is no Wooli
server involved in this app at all — no Supabase, no API routes, no
account creation, no Wooli-operated storage of anyone's financial data.

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
CloudKit sync specifically is the least-tested part of this: it also
needs a real device signed into iCloud (the Simulator's CloudKit support
is unreliable) and the container capability set up per below before it
does anything.

## Requirements

- Xcode 15+ on a Mac
- iOS 17+ deployment target (uses SwiftData, `@Query`, `#Predicate`)
- A SimpleFIN setup token from https://simplefin.org (or your bridge's
  equivalent) — a one-time-use base64 token you get after linking your
  bank(s) at the bridge.
- **An Apple Developer Program membership ($99/yr)** — required for two
  separate reasons, not just one:
  - Distributing to anyone besides yourself (TestFlight or the App Store).
    A free Apple ID only lets you build to your own registered devices from
    Xcode, with the app re-signing every 7 days.
  - Using a real CloudKit container at all, even just to test sync on your
    own devices — CloudKit containers are tied to a paid Team ID.

## Distributing to other people

- **TestFlight** (up to 10,000 external testers) or the **App Store** both
  need the $99/yr program above; there's no way around that fee once this
  is meant for anyone but you.
- Each install is fully isolated — there's no shared backend, so a bug in
  one person's data can't leak into another's the way a multi-tenant
  Supabase/RLS bug could. What you give up in exchange: no central way to
  revoke a compromised token, see usage, or push a data fix — each user's
  copy is independent.

## iCloud / CloudKit sync

`WooliApp.swift` uses a CloudKit-backed `ModelContainer`, so a user's
accounts and transactions sync across their own iPhone/iPad/Mac via their
own private iCloud database — Wooli never sees or stores this data, and
storage cost/quota is the user's own iCloud plan, not yours to pay for.
The SimpleFIN token itself is **excluded from this** on purpose (see
`KeychainHelper.swift`) — it's Keychain-only, marked
`.whenUnlockedThisDeviceOnly`, and never rides along in CloudKit, iCloud
Keychain, or device backups.

To enable it in Xcode once the project exists:

1. Target → **Signing & Capabilities** → **+ Capability** → **iCloud**
2. Check **CloudKit**, then create a container (e.g.
   `iCloud.com.yourteam.Wooli`)
3. That's it for foreground sync. Background sync (updating one device
   while another is closed) additionally needs the **Background Modes** →
   **Remote notifications** capability — left out here since it adds real
   entitlement/push-registration complexity beyond what was asked for;
   add it later if you want sync without reopening the app.

Two SwiftData schema constraints CloudKit forces (already applied in
`LocalModels.swift`): no `@Attribute(.unique)`, and every property needs a
default value. Dedup on sync is handled by hand in `SyncService` instead
of a database-level unique constraint.

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
  credentials, so it's stored in the iOS Keychain (device-only, no backup,
  no CloudKit), never in SwiftData or UserDefaults.
- `Sources/Services/SyncService.swift` — claims the token once, then on
  each sync fetches the last 90 days and upserts into SwiftData by
  provider id (same dedup key as the web app's `provider_transaction_id`).
- `Sources/Models/LocalModels.swift` — `LocalAccount` / `LocalTransaction`,
  synced via the user's own iCloud (CloudKit), never a Wooli server.
- `Sources/Views/` — Connect screen (paste token) → Accounts list →
  Transactions per account, with a manual refresh button.

## Known gaps (by design, given the "Budget/SimpleFIN only" scope)

- No categories, budgets, goals, net worth, or recurring rules
- No AI categorization (that's server-side Groq in the web app)
- Single SimpleFIN connection at a time (matches the SimpleFIN model:
  one token's access URL can already cover multiple linked banks)
- No CSV import
