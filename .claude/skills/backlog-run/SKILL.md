---
name: backlog-run
description: Work down ios/Wooli/BACKLOG.md in rounds, where one round is one epic (a whole backlog item taken as far as it can go, about four slices), with no timers and no pauses, then stop with a summary. Use when the user says /backlog-run, "run the backlog", or "build the next backlog epic". Takes an optional number of epics (default 2), e.g. /backlog-run 3.
---

# Backlog run: epics, back to back

Runs **two rounds** (or the number passed as an argument, e.g. `/backlog-run 3`), then stops. **A round is one epic**: one backlog item (or one connected group, like M2-4 or M3-4) carried through as far as it can go, built as about **four slices**. This replaces `/loop` for backlog work. `/loop` relies on a timer inside the session's container, which doesn't fire while the container is idle, so it stalls. This skill never waits: the next item starts as soon as the last one is pushed.

**Do not** call ScheduleWakeup, CronCreate, send_later or any timer. **Do not** end your turn between rounds to "report", and don't ask whether to continue. A round ends with a commit and push, then the next round starts in the same turn.

## One round (one epic)

1. **Pick the epic.** Read `ios/Wooli/BACKLOG.md` (use offset/limit or Grep; it is over 25k tokens). Take the first unfinished item in Phase M order (`PRD-MAC-TRIPS.md` §13), including the leftovers listed on 🟡 rows; then Phase 0 / D / 1 / 2 by the backlog's own order. Skip anything marked "waiting on user", "idea" or needing a user decision.
2. **Read** the PRD section for the item, and the code it touches, before writing anything.
3. **Plan the slices first** (about four, in dependency order: pure logic and tests, then the UI that uses it, then the second surface or the leftovers listed on its 🟡 row). Then **build one slice at a time**; each is useful on its own. Put pure logic in its own file (`Services/` or beside the feature) with tests in `WooliTests/`. Match existing style; use only `Theme` values in views. New Swift files need no project edits (synchronized groups).
4. **Verify what can be verified.** If `xcodebuild`/`swift` exist, build and run tests; fix failures. If not (cloud sessions), say so in the commit and the Done entry: "not built, tests not run".
5. **Log it** in `ios/Wooli/BACKLOG.md` in the same commit: update the item's status row (🟡 until every acceptance criterion is met, then ✅), add a Done entry at the top of **Done** with what shipped, what's not done and what's unverified, and add a harmonization-log line if shared iPhone code changed.
6. **Commit and push after every slice** to the session's development branch (don't batch the epic into one commit). Message `iOS: <item id> <what>`, plus the attribution lines the session gives.
7. **Print one line per slice** (not a report): `Round N.k · <item id> · <what> · <commit hash> · built: yes/no`. Repeat steps 3 to 7 for each slice. When the epic is done or its slices are used up, print `Round N done · <item id> · <status row now>` and start round N+1 immediately, until the last round is done.

N counts epics from 1 up to the round limit and k counts slices within an epic, so the user can compare rounds and slices to tokens used.

## When to stop

Stop when one of these is true, and say which:
- All rounds are done (the normal ending): print `Finished N of N rounds (S slices)`, then a short list of what shipped (item ids and commits) and what's unverified. This is the only time you write a summary.
- The remaining items all need a user decision or Xcode. Name them in one short list and ask.
- A round fails in a way you can't fix (a build or test failure you can't resolve): revert that round's uncommitted changes, log it in Inbox, say so.
- You're near the token limit (about 85% used, if the session says so): finish the current round's commit and push, then stop with `Stopped after N rounds · <reason>`.

## Guardrails (from AGENTS.md)

- Never run modifying Supabase operations; the website is frozen apart from policy pages.
- Don't create pull requests. Push only to the development branch.
- Don't expand scope: stay inside the chosen epic (extra finds go to Inbox); each slice small, don't refactor neighbours, note out-of-scope finds in **Inbox**.
- Don't mark an item ✅ unless its acceptance criteria are actually met and checked.
