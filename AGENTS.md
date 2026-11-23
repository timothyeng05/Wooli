# Wooli Development Guide

## Life Context & Muse Assistant
For Timothy's personal context, open loops, and operating guidelines as Muse, see:
`admin/context.md`

## Session Start (READ THIS FIRST)

1. Run `/standup` — it reads the backlog and proposes today's focus
2. Pick the first P1 item from the backlog
3. Ask one clarifying question if the scope is fuzzy
4. When 85% tokens used, run `/wrap` and stop new work

**Don't:** Start a feature without checking the backlog. Ask before scope-creeping.

### Standup Agent Pipeline

At every standup, spin up four agents in this order:

1. **PM Agent** — reads backlog, proposes today's focus, writes a spec to `/tmp/standup-spec.md`
2. **Designer Agent** — reads the spec, proposes UI/UX approach and component structure
3. **Engineer Agent** — implements based on designer output, runs `npm run check`
4. **QA Agent** — reviews engineer's work against the spec, fixes real bugs, runs `npm run check`

Run each agent sequentially (foreground). Do not start the next agent until the previous one completes.

---

## iOS app (`ios/Wooli`)

The native iPhone app is where active product work happens. **Before any iOS work, read `ios/Wooli/BACKLOG.md`** — the shared roadmap and backlog for every agent (Claude, Gemini, Xcode assistant). It has the collaboration rules (claim → build → log in Done), the current phase, and feature specs. Update it in the same commit as your change.

**Before any iOS UI work, read `ios/Wooli/DesignSystem/README.md`** (or use the `wooli-design-system` skill). It's the design system: colours, components, screen templates and reference images, plus `IMPLEMENTATION.md`, the build plan tracked as Phase D in the backlog. Use only `Theme` values; no new `Color(hex:)`, numeric corner radii or fixed font sizes in views.

---

## Website (`app/`)

As of 2026-10-18 the Next.js app is only a static introduction to the iPhone app, plus the pages App Store Connect links to: `/` (intro), `/privacy` (privacy policy URL), `/support` (support URL) and `/terms`. The old web features (budget, trips, lists, period, auth, API routes, crons, Supabase client) were removed; they're in git history before that date, and the Supabase data was left untouched. Keep the policy pages in step with what the app actually does with data.

## Build & verify toolkit

| Command | What it does |
|---|---|
| `npm run check` | typecheck + unit tests — run before every commit |
| `npm run typecheck` | `tsc` via `tsconfig.typecheck.json` (immune to stale `.next` types and `.claude/worktrees` copies) |
| `npm run test` | vitest unit tests (`lib/**/*.test.ts`) |
| `npm run screenshot -- <route> […]` | boots the dev server on a free port (placeholder env), captures Playwright screenshots, cleans up. Options: `--widths 1440,1024x768`, `--out dir`, `--port N` (attach to running server), `--full` |
| `npm run lint` | eslint — has pre-existing errors; advisory (non-blocking) in CI |

- **Remote sessions** (Claude Code on the web): `.claude/hooks/session-start.sh` installs dependencies and writes a placeholder `.env.local` automatically — don't hand-roll either.
- **Preview pages** for auth-free rendering go under `app/preview-{feature}/` — the `/preview-*` prefix is outside `proxy.ts`'s matcher, so no middleware changes needed. Delete before committing.
- **CI** (`.github/workflows/ci.yml`) runs typecheck + tests on every PR. Keep it green; it's the merge gate.

## Quick Reminders (Lessons from Sessions 1-2)

1. **Auth Flow:** Profiles table needs `handle_new_user()` trigger. Don't skip database migrations.
2. **Imports:** Use `supabase-client.ts` in client components, `supabase-server.ts` in server components. Never mix.
3. **Server vs Client:** Server components check auth + fetch data. Client components handle forms + state.
4. **One Module at a Time:** Build complete module (new → list → detail) before moving to next.
5. **Database First:** Run all SQL migrations, test RLS, then write app code.
6. **Supabase Upsert Constraints:** `upsert({ ... }, { onConflict: 'columnName' })` requires a **unique** constraint on that column, not just an index. Migrations log: add `unique` to column definition. Error: "no unique or exclusion constraint matching the ON CONFLICT specification".

See `docs/LESSONS_LEARNED.md` for full details.

---

## Live Database & Financial Data Access

- **Credentials:** Live in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Read Access (Autonomous):** You are permitted and encouraged to query Supabase (and the SimpleFIN Bridge API) to read live user data, accounts, balances, transactions, and holdings when answering questions.
- **Write/Edit Access (Approval Required):** NEVER perform modifying operations (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, or running destructive migrations/scripts) on Supabase without explicitly presenting the exact changes to the user and waiting for their explicit approval first.
- **Financial Schema Mapping:**
  - `accounts`: Manual accounts (e.g. Health Equity HSA).
  - `synced_accounts`: Synced account balances and institution metadata.
  - `bank_connections`: SimpleFIN Bridge connection URLs (`access_url`).
  - **Holdings & Positions:** Querying `<access_url>/accounts` from `bank_connections` returns live holding-level securities, quantities, cost basis, and tickers (e.g. Charles Schwab, Fidelity).

---

## Three-Agent Review Pipeline

Use this when reviewing or improving an existing feature (not for greenfield builds).

**When to use:** User says "review X", "improve X", "audit X", or "let's work on Y" for a feature that already exists.

### Step 0 — Screenshots (required for PM)
1. Create `app/preview-{feature}/page.tsx` — renders the real components with mock data, no auth (`/preview-*` is outside `proxy.ts`'s matcher; no middleware changes needed)
2. `npm run screenshot -- /preview-{feature} --widths 1440,768` — boots the dev server on a free port, captures every listed route/state, cleans up after itself
3. Read all screenshots before spawning PM
4. Delete the preview page before committing

### Step 1 — PM Agent (foreground)
- Input: screenshots + code files + list of already-fixed items
- Output: writes findings to `/tmp/{feature}-spec.md` (NOT relayed through Claude)
- Format per finding: `### [F-XX] Title — P[0-3]` with What / Where / Fix / Visual evidence

### Step 2 — Builder Agent (foreground, `isolation: worktree`)
- Reads `/tmp/{feature}-spec.md` directly — no re-prompting needed
- Runs `npm run check` and reports result

### Step 3 — QA Agent (foreground, `subagent_type: general-purpose`)
- Reads `/tmp/{feature}-spec.md` as checklist
- Reviews builder's worktree files, fixes real bugs directly
- Runs `npm run check`

### Step 4 — Apply & commit (CRITICAL ORDER)
1. `diff` key files to verify
2. `cp` worktree → working directory
3. `npm run check`
4. **Commit immediately** — do NOT start round N+1 before committing round N. If round 2 worktree branches from pre-commit main, its `cp` will overwrite round 1 fixes.
5. Push

### Rules
- After each round: grep the file to verify fixes are actually present before passing findings to the next round's builder
- PM may flag already-fixed items — always cross-check against code, not just memory
- Screenshots always go through `npm run screenshot` — it handles Playwright, the remote sandbox's Chromium, ports, and cleanup

---

## Token Management

At 85% budget used, START wrapping up — run `/wrap` to write session log, diary, and update backlog. Then stop new work and use remaining ~15% only for critical fixes. (Not a hard cutoff, just a signal to be more efficient.)

---

# Next.js Breaking Changes

This version (16.2.4) has differences from older Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Pay attention to deprecation warnings (e.g., middleware convention).
