# CinemaStub

A cinema ticket for Movies, the one module besides Trips where a ticket is the real object. The rank sits on the tear-off stub.

**Proposed:** `CinemaStub(title:meta:rank:)` as the Movies hero (your latest film, or "Your list · 0 movies" when empty) and at the top of a movie's detail screen.

**Look:** a `group-fun` (rose) body and stub at `radius-m`, separated by a dashed white perforation. All text is white (4.7:1 on rose). The body has an "ADMIT ONE" `eyebrow`, the title in `title2` bold, and a meta line in `footnote`. The 84pt stub holds "RANK" and the number in `code`. It casts a soft rose shadow.

**Consumer provides:** the title, one meta line, and the rank (or a dash when it isn't ranked yet).

- Do: keep `RankStamp` for movie rows in lists; the stub is the hero.
- Don't: use a cinema stub anywhere outside Movies.

Hand-written static web rendition (proposed).
