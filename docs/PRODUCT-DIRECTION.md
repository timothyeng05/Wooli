# Wooli — Target User & Feature Roadmap

_Written by Opus 4.7 on 2026-04-25._

This doc names the target user and proposes the next 3–4 features to build. It's opinionated. If the user is wrong, the features are wrong, so disagree with the persona first.

---

## Who Wooli is for

**The optimizer who wants one dashboard for their financial + emotional life.**

Concrete persona:
- 28–45, tech-comfortable, urban
- Has 2–4 credit cards including at least one premium card (CSR, Amex Platinum, Venture X)
- Pays $400–$1,200/yr in annual fees and wants to confirm those fees pay off
- Tracks expenses but bounces between Mint / YNAB / spreadsheets — never sticks
- Has tried journaling apps (Day One, Daylio) and either lost the streak or abandoned them
- Values data ownership and control. Would rather self-host than pay $10/mo for a polished alternative
- Already comfortable with the trade-off of "build it yourself, get exactly what you want"

**The single thing that makes Wooli different from any commercial product:** it puts mood, budget, and credit-card-benefits-optimization in the same app. No competitor does all three. That's the wedge.

### Who Wooli is NOT for

- Anyone who wants polish over control (Mint, Copilot, Monarch are better)
- Anyone with one debit card and no annual fees (the cards module is wasted)
- Anyone who wants social features, sharing, or coach/therapist exports
- Mobile-first users — the layout is desktop-friendly. A real mobile app is a separate product

---

## The product thesis

Three modules in one app is only valuable if they **inform each other**. If they stay siloed, Wooli is just three half-built apps. The roadmap below is biased toward integration over feature-completeness in any one module.

The card module is the most differentiated piece — premium-card optimization is underserved. So that's where the next features should land first.

---

## Recommended next features (in order)

### Feature 1: Benefit usage tracking **[L — high value]**

**Why this first:** The whole reason to pay $550 for Chase Sapphire Reserve is to use the $300 travel credit, the $100 Global Entry credit, the lounge access, etc. Right now Wooli tracks that the benefits *exist* but not whether they've been *used*. Without this, the "net value" number on the card detail page is theoretical — it assumes 100% benefit utilization, which is rarely true.

**What to build:**
- On `/cards/[id]`, each benefit shows a "Mark as used" button (and a count for multi-use benefits like monthly Uber credits)
- A `benefit_usage` table (or extend `card_benefits.usage_data` JSON which already exists in schema)
- Net value calculation updates: `actualValue = sum(used benefits) − annualFee`
- Show "Used $X of $Y annual benefits" progress bar per card

**Database:** `card_benefits.usage_data` already exists per `app/cards/[id]/page.tsx:30`. Just needs a UI and a defined schema (e.g. `{ used: number, max: number, log: [{date, amount}] }`).

---

### Feature 2: "Best card for this purchase" recommender **[M — killer feature]**

**Why next:** This is the single feature points-optimizers will tell their friends about. Every time you're at a restaurant deciding which card to swipe, you want a 1-second answer.

**What to build:**
- New page `/cards/which` (or a homepage widget): pick a category dropdown ("Dining", "Travel", "Groceries"), show ranked list of user's active cards by reward rate
- Pull from `card_rewards` table (already exists per `docs/modules/CARDS.md`)
- Bonus: amount input — show "$50 at Dining → CSR earns 150 points (~$3.00)"

**Out of scope for v1:** Auto-detection from merchant name, category guessing, mobile widget. Ship the dropdown first.

---

### Feature 3: Cross-module insights on the dashboard **[L — proves the thesis]**

**Why:** This is the payoff for having all three modules in one app. If Wooli can't tell you "you spend 40% more on Dining when your mood is below 3," then there's no reason it's not three separate apps.

**What to build (one insight at a time, ship as you go):**
1. **Mood × spending correlation** — "Your average daily spend on low-mood days (1–2): $58. On good days (4–5): $31."
2. **Activity × mood correlation** — "Days you logged 'Exercised', average mood was 4.2. Without: 3.6."
3. **Card earning summary** — "You earned ~12,400 points this month across your cards" (joins transactions to card_rewards)

Show as a 1-line insight strip above the calendar, rotating weekly. Computing these requires non-trivial SQL but they're the "wow" moment.

---

### Feature 4: Annual fee renewal radar **[M]**

**Why:** Premium cards renew once a year. Most users get hit with $550 and only then ask "did I get my money's worth?" Wooli should surface that question 60 days before renewal.

**What to build:**
- Add `cards.opened_at` date column (or use `created_at` in app)
- Dashboard banner when any card's renewal is within 60 days: "Chase Sapphire Reserve renews in 47 days. You've used $420 of $550 in benefits this year. [Review]"
- `/cards/[id]` shows a "Renewal decision" panel with: benefits used, signup bonus value (if first year), recommendation tier (KEEP / DOWNGRADE / CANCEL)

**Depends on Feature 1** — without usage tracking, the recommendation is meaningless.

---

## What NOT to build next

- **Calendar module** — referenced in `docs/modules/CALENDAR.md` but unbuilt. Skip it. Native calendars are a solved problem; another tab in Wooli adds clutter without an integration story.
- **Goals tracking** — referenced in `~/.claude/knowledge/goals.md` but the file is empty. If the user can't fill in their own goals manually, the app can't help. Revisit after Feature 3.
- ~~**Bank connection (Plaid)** — too much complexity, regulatory exposure, and Plaid isn't free. CSV import is enough.~~ **Reversed 2026-07:** Plaid is now live (4 institutions) and is the transaction source of truth; Monarch CSV imports are retired. See `lib/budget/sync-config.ts`.
- **Social / sharing features** — wrong persona. This user wants privacy.
- **More mood data types** (sleep, weight, exercise duration) — Apple Health / Garmin / Strava own this. Don't compete.
- **AI summaries / coaching** — tempting but premature. Get the data layer right first.

---

## Suggested implementation order for Sonnet

1. **Benefit usage tracking** (Feature 1) — foundational; unlocks Feature 4 and makes the card module actually useful
2. **Best card recommender** (Feature 2) — small, high-delight, can ship in a session
3. **First cross-module insight** (Feature 3, just one — the mood × spending one) — proves the thesis
4. **Renewal radar** (Feature 4) — closes the loop on the cards module

Each is independent enough to be one or two Sonnet sessions. Don't try to scope all four into one PR.

---

## Open questions for the user before building

1. Do you have other premium cards beyond Chase Sapphire Reserve? (Affects whether Feature 4 is worth it now or later)
2. Are you actually using the budget module, or is it aspirational? (If aspirational, Feature 3 mood × spending insight needs more transactions to be meaningful — would need seed data)
3. Is anyone else going to use this app, or is it personal? (Affects how much we invest in onboarding, multi-user polish)
