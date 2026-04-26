# Wooli — System Architecture

_Updated 2026-04-26. This is the "how the whole thing fits together" doc. Read this first._

## What Wooli is

A self-hosted personal-life dashboard combining mood/journal, period tracking, lists/wishlists, budget, and credit-card-rewards optimization. One user account, one user's data, no social features. Deployed to Vercel.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | Server components fetch + auth in one place; client components handle forms |
| Language | TypeScript | Type safety where it matters; lots of `as any` still lurking on Supabase queries |
| Styling | Tailwind CSS | No CSS files except `globals.css`; everything inline |
| Backend | **Supabase** (Postgres + Auth + auto REST + RLS) | One service does auth, DB, and authorization |
| AI | **Groq** (`llama-3.3-70b-versatile`) | Fast, free for personal use; powers journal prompts and weekly summaries |
| Hosting | **Vercel** (auto-deploy on push to `main`) | Free tier handles everything |
| Domain | wooli-phi.vercel.app | |

## High-level shape: Hub and spokes

```
                           Dashboard (/)
                                │
                                │  Read-only aggregator. Never writes.
                                │  Pulls from every module in parallel.
                                │
       ┌─────────┬──────────────┼──────────────┬─────────┐
       ▼         ▼              ▼              ▼         ▼
   /mood     /period         /lists         /budget   /cards
   (Journal)              (todos/wish)
```

Each module is **self-contained**: it owns its tables, its routes, its forms, its components. The dashboard reads from all of them but writes to none. This means modules can be deleted or replaced independently — there's no shared state, no cross-module imports beyond shared `lib/` utilities.

## Top-level folders

```
app/
  page.tsx                    Dashboard
  layout.tsx                  Root layout (Nav + global styles)
  login/, signup/             Auth pages (uses /app/auth/actions.ts)
  mood/, period/              Journal module (period is a tab under Journal)
  lists/                      Lists / wishlists / todos
  budget/                     Budget tracking
  cards/                      Credit card rewards
  api/                        Server-side endpoints (mostly for AI + admin)
  components/
    Nav.tsx                   Top nav (decides active tab)
    Breadcrumbs.tsx           Used on every non-dashboard page
    JournalTabs.tsx           Sub-nav for /mood + /period
    dashboard/                Dashboard-only components (LifeCalendar, etc.)
    mood/, period/, lists/, budget/, cards/   Module-scoped components
lib/
  supabase-client.ts          Browser Supabase client (use in client components)
  supabase-server.ts          Server Supabase client (use in server components)
  groq.ts                     Groq SDK singleton
  card-utils.ts, mood-utils.ts, period-utils.ts, activity-config.ts
supabase/
  migrations/                 Numbered SQL files (001, 002, ...) — checked into git
docs/
  ARCHITECTURE.md             This file
  CONVENTIONS.md              Coding conventions
  SCHEMA.md                   Cross-module schema reference
  modules/                    Per-module deep-dive docs (MOOD, BUDGET, CARDS, ...)
  IMPROVEMENTS-PROPOSAL.md    Polish/bug backlog
  PRODUCT-DIRECTION.md        Target user + feature roadmap
  BUILD-SPEC-*.md             Plans handed to Sonnet sessions
```

## The two patterns you must internalize

### Pattern 1: Server component fetches, client component mutates

Every module page follows this shape:

```
app/lists/[id]/page.tsx              ← server component
  ├─ awaits createServerSupabaseClient()
  ├─ checks auth, redirects if no user
  ├─ fetches data with .select()
  └─ passes data to: <ListDetailView userId={...} list={...} initialItems={...} />
                          ↓
app/components/lists/ListDetailView.tsx   ← 'use client'
  ├─ uses useState/useEffect for local state
  ├─ calls createClient() (browser client) for mutations
  └─ writes optimistically, rolls back on error
```

The reason: server components have direct Supabase access via cookies, no API round-trip. Client components handle interactivity. They never share a Supabase client — wrong client = silent auth failures.

**Never** import `supabase-server.ts` in a client component. **Never** import `supabase-client.ts` in a server component. The TypeScript types will let it slide; the runtime won't.

### Pattern 2: RLS does authorization, app code doesn't

Every table has Row-Level Security enabled. The policy is almost always:

```sql
create policy "Users manage own X"
  on public.X for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

This means: even if your app code forgets to filter by `user_id`, Postgres will only return the current user's rows. The app code's `.eq('user_id', user.id)` is defense-in-depth, not the actual security boundary.

The exception: **service role bypasses RLS**. Used in `app/api/create-card/route.ts` and template seeding because cards have nested writes that hit RLS in awkward ways. Service role calls must be server-side only and must validate the user is who they say they are.

## Auth flow

1. User signs up → Supabase creates `auth.users` row
2. Database trigger `handle_new_user()` auto-creates a `public.profiles` row (1:1 with auth.users, with email mirrored over)
3. Login → cookie set via `@supabase/ssr`
4. Every request: Next.js middleware refreshes the session cookie
5. Server components read user via `createServerSupabaseClient()` → `.auth.getUser()`
6. Client components read via `createClient().auth.getUser()` (rarely needed; usually receive `userId` as prop)

If `auth.getUser()` returns null in a protected page, redirect to `/login`. This pattern is on every server-component page.

## How the dashboard works

`app/page.tsx` runs four parallel Supabase queries (mood, period, transactions, cards) and renders three module summaries side-by-side. It also kicks off two client-side fetches:
- `<WeeklySummary />` — calls `/api/weekly-summary` to render or fetch a Groq-generated reflection card
- The mood calendar's month-nav fires `/api/calendar` for past/future months

The dashboard is the only place where data from multiple modules is colocated. Everything else stays modular.

## Data flow for a typical user action

Example: user adds a list item.

1. They type in the input on `/lists/[id]` and press Enter
2. `ListDetailView.tsx` (client component) calls `supabase.from('list_items').insert(...)` directly via the browser client
3. RLS checks: does the inserted `user_id` match `auth.uid()`? Yes → row created
4. The component appends the new row to local state optimistically (no page reload)
5. If the insert fails, local state is rolled back

There is no `/api/list-items` endpoint. We don't need one — Supabase's PostgREST auto-generates a REST API, and the JS client wraps it. **API routes only exist for things Supabase can't do**: AI calls (Groq), service-role admin work, cross-row aggregations that benefit from server-side computation.

## When to write an API route vs. talk to Supabase directly

| Use case | Where it lives |
|---|---|
| Read/write a row the user owns | Direct Supabase call from the client component |
| Server-rendered initial data | Direct Supabase call from the server component |
| AI / external API call | API route (e.g. `/api/journal-prompts`) |
| Service-role write (bypass RLS) | API route |
| Cross-table aggregation that's expensive | Either a Postgres view + direct call, OR an API route |
| Admin / one-shot data setup | API route, gated to dev or admin (currently NOT gated — see proposal) |

## The AI integration

`lib/groq.ts` exports a singleton. Two API routes use it:

- `/api/journal-prompts` — generates 3 reflection questions based on last 7 days of mood entries; cached daily in localStorage on the client
- `/api/weekly-summary` — generates a 2–3 sentence weekly reflection; cached in `weekly_summaries` table by `(user_id, week_start)`

Both routes fail gracefully: if `GROQ_API_KEY` is missing or Groq errors, they return either fallback content or null. Nothing user-facing breaks.

## Calendar rendering: how mood + period + activities + notes coexist

`LifeCalendar.tsx` is the single most layered component. Each day cell renders, in order:

1. Background color = mood (red→green for 1→5; gray if no entry)
2. Activity emojis spread full-width across the bottom (🏃 📖 😴 🧘)
3. Period flow bar (3px bottom strip) — color depends on flow level
4. Notes indicator (✏️ in top-right)
5. Today ring (blue 2px)
6. Predicted-period dashed pink border

A click on a past day with a mood entry → `/mood/[id]`. A click on a past empty day → `/mood/new?date=YYYY-MM-DD`. Future days are non-clickable.

This tight integration is the proof-of-concept for the "three modules in one app" thesis: the dashboard calendar shows mood + period + activities all at once because they're all aspects of the same day.

## Things that look like coupling but aren't

- **`Nav.tsx` knows about `/period`** because the Journal nav stays active when you're on a period page. This is hard-coded in `alsoMatches: ['/period']` and is fine — nav is allowed to know about routes.
- **`app/page.tsx` queries five tables.** That's the dashboard's job. Nothing else should import data from multiple modules.
- **`docs/modules/*.md`** are co-located in `docs/` rather than each module folder. Tradeoff: easier to read all together, slightly less "pure" modularity. Don't refactor.

## Things you should not do

- Don't put auth or `getUser()` calls in middleware logic — keep them in pages so the redirect is explicit
- Don't fetch data in client components if a server component could do it — costs an extra request and breaks SSR
- Don't share state between modules via context or a global store. If two modules need the same data, the dashboard joins them; the modules stay ignorant of each other
- Don't write SQL inline in app code; put schema changes in `supabase/migrations/NNN_name.sql` so they're reviewable
- Don't add a feature flag system. We have one user. Just change the code

## Token-efficient reading order (for AI agents and humans)

1. This file
2. `docs/modules/{module}.md` for whichever module you're touching
3. The single page or component file you're modifying
4. Stop. Don't fan out.

The AGENTS.md at the repo root reinforces this for AI sessions.

## Open architecture questions (no decisions yet)

- **TypeScript types from Supabase**: we should run `supabase gen types` to kill the `as any` casts on nested queries. Hasn't happened yet.
- **`lib/supabase-admin.ts`**: service-role client is duplicated across `cards/new/page.tsx` and `api/create-card/route.ts`. Could consolidate.
- **Middleware deprecation**: Next.js 16 wants `proxy.ts` instead of `middleware.ts`. Build still works; warnings still print.
- **No tests**: zero test coverage. Acceptable while the user is the only user. Revisit if anyone else starts using the app.
