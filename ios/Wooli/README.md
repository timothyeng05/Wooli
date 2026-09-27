# Wooli for iPhone (private, on-device budget)

A native SwiftUI version of Wooli's **Budget** module, built so each person's
financial data stays theirs:

- **No Wooli server.** No Supabase, no API routes, no account sign-up.
- **Bank data comes straight from SimpleFIN** to the phone, using the person's own
  SimpleFIN setup token.
- **The SimpleFIN access key lives in the Keychain**, saved as a synchronizable
  item. It travels in the user's iCloud Keychain (always end-to-end encrypted,
  like saved passwords), so a new iPhone on the same Apple ID connects without a
  new setup token. It's never stored in SwiftData/CloudKit or anywhere Wooli can read it.
- **Accounts, transactions, categories and rules are stored in SwiftData**, and
  sync only through the person's own private iCloud once CloudKit is enabled (below).

## What's in it

It's styled like the Wooli website (gray page, white bordered cards, uppercase
labels, emoji category tiles, blue `#2563eb`, the sheep logo) but built from
standard iOS components.

| Tab | What it does |
|---|---|
| **Dashboard** | Greeting, review shortcut, budget card (income vs. planned, expenses vs. planned), net worth with 1M–All ranges, this-month vs. last-month spending, recent transactions |
| **Accounts** | Net worth chart; Cash / Credit Cards / Investments / Loans cards with change over the range and % of assets or liabilities; bank logos; "Show N hidden accounts" |
| **Transactions** | Day groups with daily totals, summary line, search, a filters sheet (date range, sort, accounts, categories, merchants, amounts), swipe to review or hide |
| **Reports** | Income / spending / saved tiles, 6-month cash flow, spending by category, top merchants |
| **Budget** | Month navigation, left to spend, planned income, per-group planned amounts, 6-month spending chart |

**Review flow:** tap the checkmark button (or the Dashboard card) to go through
transactions one at a time. "N remaining" shows at the top. Each card has the
bank's original statement, suggested category chips, notes and a hide toggle,
with **Skip for now** and **Mark as reviewed** buttons.

**Net worth history:** SimpleFIN only reports today's balance, so each sync saves
one balance per account per day. The charts fill in from the day you start using
the app. Sample data includes a year of history.

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
`-tab N` opens tab N (0–4), and `-review` opens the review flow.

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
- Default categories are seeded only when connecting for the first time. A new
  iPhone that picks up the key from iCloud Keychain skips setup and waits for the
  existing categories to sync down, so they aren't duplicated.
- Sync goes to the user's **private** database, so neither Apple nor you can read it
  if they turn on Advanced Data Protection.

## Code map

```
Wooli/
  WooliApp.swift              app entry, SwiftData container
  Models/Models.swift         LocalAccount, LocalTransaction, BudgetCategory, MerchantRule, BalanceSnapshot
  Models/DefaultCategories    starter category tree
  SimpleFin/                  SimpleFIN protocol client + response models
  Services/
    SyncService               claim token, fetch, merge (never overwrites user edits)
    Categorizer               merchant rules + keyword hints, review confirmation
    MerchantNormalizer        port of the web normalizer
    BudgetMath                month totals, currency formatting
    History                   chart ranges, balance history, cumulative spending, transaction filters
    AppModel                  mode (onboarding / live / sample), sync state, erase
    KeychainHelper            iCloud Keychain secret storage
    SampleData                6 months of realistic demo data
  Views/Theme.swift           web design tokens, cards, badges, bank logos, sheep logo
  Views/                      SwiftUI screens (standard iOS components, SF Symbols, Swift Charts)
```
