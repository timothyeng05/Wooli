# Wooli for iPhone (private, on-device budget)

A native SwiftUI version of Wooli's **Budget** module, built so each person's
financial data stays theirs:

- **No Wooli server.** No Supabase, no API routes, no account sign-up.
- **Bank data comes straight from SimpleFIN** to the phone, using the person's own
  SimpleFIN setup token.
- **The SimpleFIN access key lives only in this iPhone's Keychain**
  (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), so it's not in iCloud
  Keychain, iCloud sync, or backups.
- **Accounts, transactions, categories and rules are stored in SwiftData**, and
  sync only through the person's own private iCloud once CloudKit is enabled (below).

## What's in it

| Tab | What it does |
|---|---|
| **Overview** | Net worth, this month's spending vs. target, spending donut, review shortcut, recent activity |
| **Transactions** | Grouped by day, search, "To Review" filter, swipe right to mark reviewed, swipe left to hide |
| **Budget** | Month navigation, left-to-spend, 6-month chart, per-group targets and breakdown, cash flow |
| **Accounts** | Grouped by type, net worth, nickname/type/hide per account, per-account activity |
| **Settings** | Connect/sync, category editor, privacy summary, disconnect and erase |

Ported from the web app:
- The default category tree (`app/api/setup-budget/route.ts`).
- Merchant normalization (`lib/budget/categorize/normalize-merchant.ts`); it passes
  the same cases as the web tests.
- The review-queue rules: everything starts unreviewed, a transaction needs a
  category before it can be marked reviewed, and confirming one teaches a
  merchant rule.
- The money rules: positive is income, and transfers are excluded.

Not included (yet): AI categorization (it runs server-side on the web), recurring
rules, goals, CSV import, investments, household map.

## Running it

1. Open `ios/Wooli/Wooli.xcodeproj` in Xcode.
2. Pick an iPhone simulator and press **Run** (⌘R).
3. On the welcome screen, choose **Explore with Sample Data** or **Connect with SimpleFIN**.

Debug-only launch arguments for quick Simulator checks: `-sampleData` skips onboarding,
and `-tab N` opens tab N (0–3).

## Putting it on a real iPhone

**Just your own phone (free):** plug it in, select it as the run destination, and in
**Signing & Capabilities** choose your Personal Team. The app must be re-installed
every 7 days.

**Someone else's phone (Apple Developer Program, $99/yr):**
1. **Signing & Capabilities** → choose your paid team, and change the bundle id
   (`com.wooli.budget`) to one you own.
2. **Product → Archive**, then **Distribute App → TestFlight**.
3. In App Store Connect, add the person as an external tester. They install
   TestFlight and open the invite. Builds expire after 90 days.

## Turning on iCloud sync (needs the paid program)

1. Target → **Signing & Capabilities** → **+ Capability** → **iCloud** → check
   **CloudKit** → add a container (e.g. `iCloud.com.yourname.wooli`).
2. **+ Capability** → **Background Modes** → **Remote notifications** (so other
   devices update without being opened).

`WooliApp.swift` already uses `cloudKitDatabase: .automatic`, which picks up the
container once it exists. Until then, data is stored only on the device.

CloudKit notes:
- The models follow CloudKit's rules: no unique constraints, and every property has a default.
- Default categories are seeded when the store is empty. If two devices both start
  fresh before syncing, the categories can be duplicated. Set up on one device first.
- Sync goes to the user's **private** database, so neither Apple nor you can read it
  if they turn on Advanced Data Protection.

## Code map

```
Wooli/
  WooliApp.swift              app entry, SwiftData container
  Models/Models.swift         LocalAccount, LocalTransaction, BudgetCategory, MerchantRule
  Models/DefaultCategories    starter category tree
  SimpleFin/                  SimpleFIN protocol client + response models
  Services/
    SyncService               claim token, fetch, merge (never overwrites user edits)
    Categorizer               merchant rules + keyword hints, review confirmation
    MerchantNormalizer        port of the web normalizer
    BudgetMath                month totals, currency formatting
    AppModel                  mode (onboarding / live / sample), sync state, erase
    KeychainHelper            device-only secret storage
    SampleData                6 months of realistic demo data
  Views/                      SwiftUI screens (standard iOS components, SF Symbols, Swift Charts)
```
