# DepartureBoard

An airport departures board for things that are scheduled and have a status. Recurring bills read like flights: when, what, and whether they've left.

**Proposed:** `DepartureBoard(rows:)` for the Recurring screen and the Today screen's "Next up" (a bill, a flight, a dinner reservation, a period prediction), up to 5 rows.

**Look:** a `board` navy panel at `radius-m` with a faint inner hairline, so it holds in dark mode. Columns are DUE (split-flap date cells: `on-board` characters on `board-cell`, `mono`), WHAT (name and amount in `body` sans, `on-ticket`) and STATUS. Headers are `eyebrow` in `board-muted`.

**Statuses (always the word):**
- DUE: `on-board` yellow.
- PAID or DONE: `board-muted`.
- LATE: `board-late`.

**Consumer provides:** rows of date, name, optional amount and status. The board doesn't scroll; "See all" opens the full list.

- Do: sort by date, soonest first, with paid items dropping off after a day.
- Don't: use it for things without a date, or animate the flaps on every load. Flip only when a status changes.

Hand-written static web rendition (proposed).
