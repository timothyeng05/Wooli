# EmptyState

What a module shows before it has anything in it: an invitation, not an apology. It replaces the mix of `ContentUnavailableView` and custom empty cards.

**Proposed:** `WooliEmptyState(symbol:title:message:action:)` in `Theme.swift`.

**Look:** a 64pt `brand-soft` circle holding the module's SF Symbol in `brand-dark`, a `headline` title, one `subheadline` sentence in `text-secondary`, and one primary `Button`, all centred with `space-12` between and `space-24` around.

**Copy pattern:**
- The title names the first thing to do: "Plan your first trip", "Add a place you loved", "Connect your bank".
- The sentence says what the module holds.
- The button is the add action: "+ New trip", "+ Add place", "+ Add movie".

**Consumer provides:** a symbol, a title, a sentence, and the add action.

- Do: use the same words as the toolbar add button, so the action reads the same before and after the first item.
- Don't: write "Nothing here yet", show more than one button, or add illustrations.

Hand-written static web rendition (proposed).
