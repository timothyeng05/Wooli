# Wooli design system

The source of truth for how the iPhone app looks. It was designed on 2026-10-28 and is a step ahead of the code: `IMPLEMENTATION.md` is the plan for moving the app onto it, tracked as Phase D in `../BACKLOG.md`.

Live, editable version (previews in light and dark, comments): https://claude.ai/code/artifact/c77e186c-024f-4312-a4c5-86f0bed2f583. When it changes, update this folder in the same commit as the code that follows it.

## Read in this order

1. **`brand.md`**: the rules. Voice, colour (including the seven group colours), travel motifs, type, spacing, accessibility.
2. **`screens.md`**: the three screen templates, "one way to do each thing", and what changes in each module.
3. **`components/<Name>.md`**: one file per component: what it is, the SwiftUI API to build, exact values, and do's and don'ts.
4. **`reference/<Name>-light.png` and `-dark.png`**: the visual target for every component and screen. Compare the Simulator against these.
5. **`IMPLEMENTATION.md`**: the step-by-step build plan (D1–D9), the token → Swift table, and "done when" checks.

## Files

| Path | What |
|---|---|
| `tokens.json` | Every colour, type style, spacing step, radius and shadow, with usage notes and contrast ratios |
| `brand.md` | The brand book |
| `screens.md` | Screen templates and module-by-module changes |
| `components/` | One Markdown file per component, plus `_Logos.md` and `_Institutions.md` |
| `previews/` | Static web renditions. Open `previews/index.html` in a browser; set `data-theme="dark"` on `<html>` for dark mode. `tokens.css` is generated from `tokens.json` |
| `reference/` | PNG renders of every preview in light and dark |
| `IMPLEMENTATION.md` | The build plan for SwiftUI |

## The short version

- Blue (`#2563eb`) is for actions. Colour otherwise says what kind of thing something is, the same in every module: travel blue, food yellow, home violet, health teal, fun rose, shopping pink, money slate. Green and red are only for money, always with a sign and an arrow.
- Every overview: large title, then **one** hero object matched to the module (a ticket for Trips, a route for Budget, a passport for Eats, a cinema stub for Movies, a departures board for Today), then `SectionBand`s with `ItemRow`s.
- Four radii (10, 14, 22, full), six spacing steps (4–24), Dynamic Type plus four extra styles (`amount`, `display`, `code`, `eyebrow`). No other values.
