# Conventions

## File Naming

| Type | Convention | Example |
|---|---|---|
| Pages | `page.tsx` in route folder | `app/mood/page.tsx` |
| Layouts | `layout.tsx` in route folder | `app/layout.tsx` |
| Components | `PascalCase.tsx` | `MoodEntryCard.tsx` |
| Hooks | `camelCase.ts`, prefix `use` | `useMoodEntries.ts` |
| Server actions | `camelCase.ts`, suffix `Actions` | `moodActions.ts` |
| Utility functions | `camelCase.ts` | `formatCurrency.ts` |
| Types | `camelCase.ts` | `database.ts` |

## Component Patterns

**Server components by default.** Add `'use client'` only when needed (event handlers, hooks, browser APIs).

**Component location:**
- `src/components/ui/` — shared primitives used across modules (Button, Input, Card, etc.)
- `src/components/{module}/` — components scoped to one module
- `src/components/dashboard/` — dashboard-only components
- Co-locate small one-off components with the page that uses them

**Props:** TypeScript interfaces, no `any`. Explicit return types on server components not required.

**No default exports for utilities** — use named exports. Pages/layouts use default exports (Next.js requirement).

## Data Fetching

- Server components fetch directly via `createServerClient` — no useEffect, no loading state needed
- Client components use custom hooks wrapping Supabase browser client
- Mutations: Next.js Server Actions (`'use server'`), revalidate with `revalidatePath`
- Never fetch on the dashboard — read from pre-built Postgres views or pass data as props from server layout

## TypeScript

- Strict mode on
- Database row types live in `src/types/database.ts`
- Use `Database['public']['Tables']['table_name']['Row']` pattern or define explicit interfaces per module
- No `any` — use `unknown` and narrow if needed

## Tailwind

- Utility classes only — no custom CSS unless unavoidable
- Responsive: mobile-first (`sm:`, `md:`, `lg:`)
- Dark mode: not planned yet — don't add `dark:` classes prematurely

## Forms

- Controlled inputs with `useState` or uncontrolled with `useRef`
- Server Actions for submission — no manual fetch/axios
- Validate on server side; show errors returned from action

## Error Handling

- Server Actions return `{ error: string } | { data: T }` — never throw to the client
- Display errors inline near the form, not in a toast (unless it's a transient background op)

## Imports

- Path alias `@/` maps to `src/` — use it always, no relative `../../`
- Import order: React → Next.js → third-party → `@/lib` → `@/components` → `@/types`
