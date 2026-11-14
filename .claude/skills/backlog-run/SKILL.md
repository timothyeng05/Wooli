---
name: backlog-run
description: Work down ios/Wooli/BACKLOG.md continuously, one item after another in the same turn, with no timers and no pauses between items, until the session's tokens run out. Counts rounds so the user can measure how many fit in a budget. Use when the user says /backlog-run, "run the backlog", "keep building until I run out", or "build the backlog non-stop".
---

# Backlog run: build item after item until the budget ends

This replaces `/loop` for backlog work. `/loop` relies on a timer inside the session's container, which doesn't fire while the container is idle, so it stalls. This skill never waits: the next item starts as soon as the last one is pushed.

**Do not** call ScheduleWakeup, CronCreate, send_later or any timer. **Do not** end your turn between rounds to "report", and don't ask whether to continue. A round ends with a commit and push, then the next round starts in the same turn.

## One round

1. **Pick.** Read `ios/Wooli/BACKLOG.md` (use offset/limit or Grep; it is over 25k tokens). Take the first unfinished item in Phase M order (`PRD-MAC-TRIPS.md` §13), including the leftovers listed on 🟡 rows; then Phase 0 / D / 1 / 2 by the backlog's own order. Skip anything marked "waiting on user", "idea" or needing a user decision.
2. **Read** the PRD section for the item, and the code it touches, before writing anything.
3. **Build one small slice** that is useful on its own. Put pure logic in its own file (`Services/` or beside the feature) with tests in `WooliTests/`. Match existing style; use only `Theme` values in views. New Swift files need no project edits (synchronized groups).
4. **Verify what can be verified.** If `xcodebuild`/`swift` exist, build and run tests; fix failures. If not (cloud sessions), say so in the commit and the Done entry: "not built, tests not run".
5. **Log it** in `ios/Wooli/BACKLOG.md` in the same commit: update the item's status row (🟡 until every acceptance criterion is met, then ✅), add a Done entry at the top of **Done** with what shipped, what's not done and what's unverified, and add a harmonization-log line if shared iPhone code changed.
6. **Commit and push** to the session's development branch. Message `iOS: <item id> <what>`, plus the attribution lines the session gives.
7. **Print one line** (not a report): `Round N · <item id> · <commit hash> · built: yes/no`. Then start round N+1 immediately.

N is a running count from 1 for this invocation, so the user can compare rounds to tokens used.

## When to stop

Stop only when one of these is true, and say which:
- The remaining items all need a user decision or Xcode. Name them in one short list and ask.
- A round fails in a way you can't fix (a build or test failure you can't resolve): revert that round's uncommitted changes, log it in Inbox, say so.
- Tokens run out. If the session says you're near the limit (about 85% used), finish the current round's commit and push, then stop with the final line: `Stopped after N rounds · <reason>`.

## Guardrails (from AGENTS.md)

- Never run modifying Supabase operations; the website is frozen apart from policy pages.
- Don't create pull requests. Push only to the development branch.
- Don't expand scope: one slice per round, don't refactor neighbours, note out-of-scope finds in **Inbox**.
- Don't mark an item ✅ unless its acceptance criteria are actually met and checked.
