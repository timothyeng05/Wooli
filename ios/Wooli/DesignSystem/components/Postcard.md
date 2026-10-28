# Postcard

A note from one place or memory: a postcard with a stamp in the corner and a wavy postmark across it.

**Proposed:** `Postcard(from:title:message:stamp:group:)` for the notes card on an Eats place, a recipe "from Lisbon", and the summary card when a trip ends.

**Look:** a `card` at `radius-m` with `space-20` padding. Top right is a 44×52 stamp box with a dotted 2pt edge in the group colour, a 14% wash and the item's emoji, crossed by three wavy postmark lines in `text-tertiary`. Text runs from an `eyebrow` "From …" line in `text-tertiary`, to a New York heavy 22pt title, to the message in `body`.

**Consumer provides:** where it's from, a date, a title, the message, an emoji and the group.

- Do: use it once per detail screen, for the personal note.
- Don't: use it for lists, numbers or anything editable inline. It's a keepsake, not a form.

Hand-written static web rendition (proposed).
