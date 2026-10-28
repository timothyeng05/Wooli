# TicketCard

The Trips boarding pass: a navy-to-blue gradient card with notched sides, white text and darkened inset rows. It's the hero for journeys only: Trips and transport. Other modules use `HeroCard` (the same gradient without notches), `CinemaStub` or `DepartureBoard`.

**SwiftUI today:** `TripTravelCard` and `TransportTicket` in `ios/Wooli/Wooli/Trips/`, **Proposed:** a shared `TicketCard` in `Theme.swift`, used as the Trips overview hero (the next leg) and on flight and train detail screens.

**Look:** `ticket-start` → `ticket-end` at 135°, `radius-l`, 16pt padding, 18pt notches at mid-height on both sides cut in `background`, and `shadow-ticket`. Eyebrows use `eyebrow`, and all text is `on-ticket`. Codes use `code`; amounts use `amount`. Inset rows sit on `ticket-panel` (a darkened pane) at `radius-s` with `ticket-rule` dividers. Row icons are white 26pt circles holding a `ticket-start` SF Symbol. Route lines are 2pt `ticket-rule` dashes, and overnight +1 markers use `ticket-highlight`.

**Consumer provides:** an eyebrow, the main figure (a route or an amount), one meta line, and up to four rows.

- Do: use it only for something that goes from A to B. Below it the page continues in ordinary `Card`s and `SectionBand`s.
- Do: keep the money arrow (↗/↘) on the ticket, since green and red aren't used on it.
- Don't: use a ticket for a budget, a list or a summary; that's what made it confusing. Don't stack two tickets.
- Don't: fade the white text for hierarchy; use size and weight.

Hand-written static web rendition, a proposed extension of `TripTravelCard`.
