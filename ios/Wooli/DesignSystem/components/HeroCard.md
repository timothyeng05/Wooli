# HeroCard

The one dark-blue block at the top of an overview that isn't about a journey. It has the ticket's gradient and type, but no notches and no route ends, so it never pretends to be a ticket. Inside it goes the module's own travel object.

**Proposed:** `HeroCard(eyebrow:) { content }` in `Theme.swift`. Trips uses `TicketCard` instead, because a trip really is from A to B.

**Look:** `ticket-start` → `ticket-end` at 135°, `radius-l`, `space-16` padding, `shadow-ticket`, all text `on-ticket`. It opens with an `eyebrow`, then usually an `amount`.

**What goes inside, by module:**
- **Budget: RouteProgress.** The month as a road: a dashed road ahead in `ticket-rule`, the solid road travelled in `on-ticket`, a start stop, and a `ticket-highlight` you-are-here pin. Labels underneath read "Oct 1 · Day 21 · $214 under your usual pace · Oct 31". Use the same component for savings goals and trip countdowns.
- **Eats: the passport.** "Your passport · 42 places", with the last three stamps in white outline.
- **Period:** the cycle as a route, day 12 of about 28.

**Consumer provides:** an eyebrow, the main figure, and one motif (a route, stamps or rows on `ticket-panel`).

- Do: use one per screen, at the top, and only on Overview screens.
- Don't: add notches. Notches mean "ticket", and tickets are for journeys.

Hand-written static web rendition (proposed).
