# PlaceSearchCheck

Checks "Find a place" around the world on your Mac, without the Simulator. For each place it:

1. types half the name the way the app does, limited to ~25 km around the place (a trip's destination), and counts Apple's suggestions;
2. types the full name and checks the place is among them;
3. if Apple misses it, asks Google Places (only when `GOOGLE_PLACES_API_KEY` is in `Config/Secrets.xcconfig`).

It passes when at least 80% of places show 3+ suggestions while typing and no more than 10% are found on neither.

```bash
cd ios/Wooli
swift tools/PlaceSearchCheck/main.swift            # built-in list: 40 restaurants, sights and stations on every continent
swift tools/PlaceSearchCheck/main.swift my-places.json   # your own places
```

## Your own places

`export_places.py` turns the app's `trips.json` / `eats.json` into a list; its header shows how to copy them off a phone running a development build. Keep the exported file out of git.

## Caveats

- Apple throttles a burst of searches from one app: a run of "0 sugg" lines in a row means the check was throttled, not that the places are missing. It waits a second between searches to avoid that, so 200 places take about 8 minutes; re-run the misses if it still happens.
- The count is the completer's first answer for that text. In the app the list keeps updating as more arrive, so a low count here (1 or 2) can be higher on the phone.
- A name match is loose (one name contains the other). Places saved under your own nickname won't match Apple's name.
- Each Google lookup is one Text Search request (free up to 5,000 a month).
