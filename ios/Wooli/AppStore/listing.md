# App Store Connect — listing text (version 1.0, build 4)

Copy each block into App Store Connect → Wooli. Limits in brackets. Edit freely — this is a draft.

## App Information

**Name** [30]: `Wooli`

**Subtitle** [30]: `Budget, trips & places to eat`

**Category:** Primary **Finance**, secondary **Travel**

**Privacy Policy URL:** `https://<your Vercel domain>/privacy`
**Support URL:** `https://<your Vercel domain>/support`

**Age rating:** answer "None" to every question → 4+. (No user-generated content is public; sharing is only with people you invite.)

## Version 1.0

**Promotional text** [170]:
```
Your money, trips and favorite places in one private app. No accounts, no ads, nothing sent to us — everything stays on your iPhone and your own iCloud.
```

**Description** [4000]:
```
Wooli is a home for the things you keep track of: your budget, your trips, the places you love to eat, the movies you've watched and the recipes you want to cook. Everything stays on your iPhone and in your own iCloud. There's no Wooli account and no Wooli server.

BUDGET
• Connect your banks through SimpleFIN, or enter amounts yourself
• Spending Pace shows whether this month is on track, against your usual months
• Plan income and expenses by category and see what's left to spend
• Review new transactions one at a time with suggested categories
• Recurring bills and income, rules, net worth and reports

TRIPS
• Plan day by day: stays, flights, trains, meals and ideas
• Find places with Apple Maps and open their full listing
• Invite friends to plan a trip together

EATS
• Rank restaurants by comparing them — "which was better?"
• Keep a Want to Try list; share places straight from Apple Maps
• Share an Instagram reel and Wooli finds the restaurants in it
• Share one list with your partner

MOVIES & RECIPES
• Rank films the same way you rank restaurants
• Share a recipe reel and Wooli splits it into ingredients and steps

PERIOD (optional)
• Log your cycle privately, on your phone

PRIVATE BY DESIGN
• Data Not Collected: no analytics, no ads, no tracking
• Sync through your private iCloud only
• Bank data goes from SimpleFIN straight to your phone
• Optional Face ID lock for Period

Bank connections use SimpleFIN Bridge, a separate service you sign up for and pay directly.
```

**Keywords** [100, comma-separated, no spaces]:
```
budget,spending,expense,tracker,trip,planner,itinerary,restaurant,ranking,recipe,movie,private,money
```

**What's New:** not shown for the first version.

**Copyright:** `2026 Timothy Eng`

## App Review Information

**Sign-in required:** No.

**Notes** [4000]:
```
Wooli has no account or sign-in. All data is stored on the device and in the user's private iCloud (CloudKit).

Bank connections are optional and use SimpleFIN Bridge (a third-party service the user pays for). To review without a bank: on first launch choose the apps you want, skip the bank step, and the Budget app works with manual entries.

Instagram import: share any public Instagram reel or post to Wooli from Instagram's share sheet. Wooli reads the public caption on-device to find restaurants (shown in Eats) or a recipe (shown in Recipes).

Apple Maps sharing: in Apple Maps, share a restaurant to Wooli to rank it or save it to Want to Try.
```

**Contact:** Timothy Eng · woolitravel@gmail.com · (your phone)

## Still to do by hand
- Screenshots: 6.9" iPhone (1320×2868 or 1290×2796) — at least 3, up to 10.
- Deploy the CloudKit schema to Production before submitting (see BACKLOG release checklist).
- Replace `<your Vercel domain>` above.
