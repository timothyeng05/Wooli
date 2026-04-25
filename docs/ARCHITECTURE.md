# Architecture

## Stack
- **Framework:** Next.js 14+ App Router, TypeScript, Tailwind CSS
- **Backend:** Supabase (auth + Postgres + auto-generated REST/realtime)
- **Hosting:** Vercel (TBD — not yet deployed)

## Structure: Hub and Spokes

```
/                  → Dashboard (read-only aggregate view)
/budget            → Budget & transactions module
/cards             → Credit card rewards tracking module
/mood              → Mood tracker module
/calendar          → Calendar / journal module
```

Dashboard never writes. It aggregates data via Postgres views or parallel queries.
Each module is self-contained: owns its own tables, forms, routes, and logic.

Quick Add on dashboard = deep links to each module's `/new` route.

## File Layout (App Router)

```
src/
  app/
    layout.tsx            ← root layout, session provider
    page.tsx              ← dashboard
    budget/
      page.tsx
      new/page.tsx
      [id]/page.tsx
    cards/
    mood/
    calendar/
  components/
    ui/                   ← shared primitives (button, input, etc.)
    dashboard/            ← dashboard-only components
    budget/               ← module-scoped components
    cards/
    mood/
    calendar/
  lib/
    supabase/
      client.ts           ← browser client (createBrowserClient)
      server.ts           ← server client (createServerClient)
      middleware.ts        ← session refresh middleware
    utils.ts
  types/
    database.ts           ← generated or hand-written Supabase types
```

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth | Supabase Auth | Built-in, no extra service |
| Session | SSR cookies via @supabase/ssr | Works with App Router server components |
| Profile storage | public.profiles (not auth.users metadata) | Cleaner, queryable, extensible |
| RLS | Enabled on every table | Security by default |
| Dashboard writes | Never | Keeps dashboard simple and safe |
| Module coupling | None | Each module deployable/removable independently |

## Auth Flow

1. User signs up → Supabase creates `auth.users` row
2. DB trigger auto-creates `public.profiles` row (1:1)
3. Login → session cookie set via `@supabase/ssr`
4. Middleware refreshes session on every request
5. Server components read session via `createServerClient`
6. Client components use `createBrowserClient`

## Protected Routes

All `/budget`, `/cards`, `/mood`, `/calendar`, and `/` routes require auth.
Redirect to `/login` if no session. Handled in `middleware.ts`.
