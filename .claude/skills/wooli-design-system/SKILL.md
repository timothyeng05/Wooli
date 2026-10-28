---
name: wooli-design-system
description: Use before building or changing any SwiftUI view in the Wooli iPhone app, or when asked about Wooli's colours, components, screen layout or design system. Loads the rules, component specs and reference images from ios/Wooli/DesignSystem.
---

# Wooli design system

Wooli's look is defined in `ios/Wooli/DesignSystem/`. Follow it for every UI change.

## Before you write UI code

1. Read `ios/Wooli/DesignSystem/README.md`, then `brand.md` and `screens.md`.
2. For each component you touch or build, read `components/<Name>.md`.
3. Look at the matching `reference/<Name>-light.png` and `-dark.png`; they're the visual target.
4. If the work is a Phase D item in `ios/Wooli/BACKLOG.md`, follow that step in `IMPLEMENTATION.md`, including its "done when" checks.

## Rules that always apply

- Colours come from `Theme` only. Blue (`Theme.brand`) means "you can act on this". Group colours (`Theme.Group`: travel blue, food yellow, home violet, health teal, fun rose, shopping pink, money slate) say what something is, the same in every module. Green and red are for money amounts only, with a sign and an arrow.
- Text on teal, pink, yellow and amber is `Theme.onAccent` (navy); on blue, rose, violet and slate it's white. Yellow is a fill, never a thin line or a small dot on white.
- Scales only: `Space` (4, 8, 12, 16, 20, 24), `Radius` (10, 14, 22, or Capsule/Circle), Dynamic Type styles plus `.wooliFont(.amount | .display | .code | .eyebrow)`. No `Color(hex:)`, numeric `cornerRadius:` or `.font(.system(size:))` in views.
- Screens use one of three templates (Overview, Detail, Edit). An Overview has exactly one hero object, matched to the module: `TicketCard` for Trips only, `HeroCard` (with a route or stamps) for Budget, Eats, Recipes and Period, `CinemaStub` for Movies, `DepartureBoard` for Today.
- Lists use `ItemRow`; empty screens use `EmptyState`; actions use `WooliButtonStyle` (one primary per screen).

## Checking your work

Build with the command in `ios/Wooli/BACKLOG.md`, run with `-sampleData`, and compare the screen in light and dark mode against `reference/`. If the design needs to change, update the matching file in `ios/Wooli/DesignSystem/` in the same commit and say so in the commit message.
