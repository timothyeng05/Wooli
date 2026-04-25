# Wooli Development Guide

## Session Start (READ THIS FIRST)

1. Run `/standup` — it reads the backlog and proposes today's focus
2. Pick the first P1 item from the backlog
3. Ask one clarifying question if the scope is fuzzy
4. When 85% tokens used, run `/wrap` and stop new work

**Don't:** Start a feature without checking the backlog. Ask before scope-creeping.

---

## Quick Reminders (Lessons from Sessions 1-2)

1. **Auth Flow:** Profiles table needs `handle_new_user()` trigger. Don't skip database migrations.
2. **Imports:** Use `supabase-client.ts` in client components, `supabase-server.ts` in server components. Never mix.
3. **Server vs Client:** Server components check auth + fetch data. Client components handle forms + state.
4. **One Module at a Time:** Build complete module (new → list → detail) before moving to next.
5. **Database First:** Run all SQL migrations, test RLS, then write app code.
6. **Supabase Upsert Constraints:** `upsert({ ... }, { onConflict: 'columnName' })` requires a **unique** constraint on that column, not just an index. Migrations log: add `unique` to column definition. Error: "no unique or exclusion constraint matching the ON CONFLICT specification".

See `docs/LESSONS_LEARNED.md` for full details.

---

## Token Management

At 85% budget used, START wrapping up — run `/wrap` to write session log, diary, and update backlog. Then stop new work and use remaining ~15% only for critical fixes. (Not a hard cutoff, just a signal to be more efficient.)

---

# Next.js Breaking Changes

This version (16.2.4) has differences from older Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Pay attention to deprecation warnings (e.g., middleware convention).
