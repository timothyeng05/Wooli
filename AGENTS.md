# Wooli Development Guide

## Session Start (READ THIS FIRST)

1. Run `/standup` — it reads the backlog and proposes today's focus
2. Pick the first P1 item from the backlog
3. Ask one clarifying question if the scope is fuzzy
4. When 85% tokens used, run `/wrap` and stop new work

**Don't:** Start a feature without checking the backlog. Ask before scope-creeping.

---

## Module focus (context efficiency)

Each major module has a **CLAUDE.md** in its route directory and a doc in `docs/modules/`. When working on one module, load only that module's context.

**Module boundaries:**

| Module | Routes | Components | Lib | Doc |
|--------|--------|------------|-----|-----|
| Budget | `app/budget/**` | `app/components/budget/**` | `lib/budget/**` | `docs/modules/BUDGET.md` |
| Trips | `app/trips/**` | `app/components/trips/**` | `lib/trips/**` | `docs/modules/TRIPS.md` |
| Mood | `app/mood/**` | `app/components/mood/**` | `lib/mood-utils.ts` | `docs/modules/MOOD.md` |
| Cards | `app/cards/**` | `app/components/cards/**` | `lib/card-utils.ts` | `docs/modules/CARDS.md` |

**Default reading order for any module work:**
1. `app/{module}/CLAUDE.md` — boundary rules and key conventions
2. `docs/modules/{module}.md` — schema, routes, components in one place
3. The single file you're modifying
4. Only fan out if doc + target file aren't enough

**Don't load:**
- Other modules' source files unless explicitly integrating
- Files the user hasn't asked you to change

**Shared infrastructure** (`lib/supabase-client.ts`, `lib/supabase-server.ts`, `lib/groq.ts`, `middleware.ts`, `app/layout.tsx`, `app/components/Nav.tsx`) is read-only for module work — don't modify it unless the task specifically requires it.

## Quick Reminders (Lessons from Sessions 1-2)

1. **Auth Flow:** Profiles table needs `handle_new_user()` trigger. Don't skip database migrations.
2. **Imports:** Use `supabase-client.ts` in client components, `supabase-server.ts` in server components. Never mix.
3. **Server vs Client:** Server components check auth + fetch data. Client components handle forms + state.
4. **One Module at a Time:** Build complete module (new → list → detail) before moving to next.
5. **Database First:** Run all SQL migrations, test RLS, then write app code.
6. **Supabase Upsert Constraints:** `upsert({ ... }, { onConflict: 'columnName' })` requires a **unique** constraint on that column, not just an index. Migrations log: add `unique` to column definition. Error: "no unique or exclusion constraint matching the ON CONFLICT specification".

See `docs/LESSONS_LEARNED.md` for full details.

---

## Three-Agent Review Pipeline

Use this when reviewing or improving an existing feature (not for greenfield builds).

**When to use:** User says "review X", "improve X", "audit X", or "let's work on Y" for a feature that already exists.

### Step 0 — Screenshots (required for PM)
1. Create `app/{route}/preview/page.tsx` — renders the component without auth, `process.env.NODE_ENV !== 'development'` guard
2. Add dev-only middleware exception for that path
3. `npm run dev &` in background, wait for 200, then Playwright screenshots of every step/state
4. Read all screenshots before spawning PM
5. After screenshots: delete preview page, revert middleware, kill dev server (`kill $(lsof -t -i:3000)`)

### Step 1 — PM Agent (foreground)
- Input: screenshots + code files + list of already-fixed items
- Output: writes findings to `/tmp/{feature}-spec.md` (NOT relayed through Claude)
- Format per finding: `### [F-XX] Title — P[0-3]` with What / Where / Fix / Visual evidence

### Step 2 — Builder Agent (foreground, `isolation: worktree`)
- Reads `/tmp/{feature}-spec.md` directly — no re-prompting needed
- Runs `npx tsc --noEmit` and reports result

### Step 3 — QA Agent (foreground, `subagent_type: general-purpose`)
- Reads `/tmp/{feature}-spec.md` as checklist
- Reviews builder's worktree files, fixes real bugs directly
- Runs `npx tsc --noEmit`

### Step 4 — Apply & commit (CRITICAL ORDER)
1. `diff` key files to verify
2. `cp` worktree → working directory
3. `npx tsc --noEmit`
4. **Commit immediately** — do NOT start round N+1 before committing round N. If round 2 worktree branches from pre-commit main, its `cp` will overwrite round 1 fixes.
5. Push

### Rules
- After each round: grep the file to verify fixes are actually present before passing findings to the next round's builder
- PM may flag already-fixed items — always cross-check against code, not just memory
- Playwright is at `require('playwright')` from project root (CJS, not ESM)

---

## Token Management

At 85% budget used, START wrapping up — run `/wrap` to write session log, diary, and update backlog. Then stop new work and use remaining ~15% only for critical fixes. (Not a hard cutoff, just a signal to be more efficient.)

---

# Next.js Breaking Changes

This version (16.2.4) has differences from older Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Pay attention to deprecation warnings (e.g., middleware convention).
