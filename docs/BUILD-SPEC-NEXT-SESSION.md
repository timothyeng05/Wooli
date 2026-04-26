# Build Spec: Next Session

_Written 2026-04-26 by Opus. Hand to Sonnet next session._

This is a self-contained spec. Sonnet should read **only the files explicitly listed below** — do not fan out into other modules.

## Reading order (cheap)

1. This file (you're reading it)
2. `docs/modules/MOOD.md` (calendar context)
3. `docs/modules/BUDGET.md` (budget context)
4. The specific files listed under each work item

**Do not** read MEMORY.md, goals/projects, other modules' source, or do exploratory grepping. The schema and routes you need are spelled out below.

## Decisions already made

- Lists stays as a top-level nav, **not under Journal** (action-oriented vs daily-logging)
- Future grouping: Journal = mood/period/fitness/meals; Lists = todos/wishlists; Budget = money in/out; Cards = rewards
- Calendar UI gets emojis (already in `lib/activity-config.ts`), not dots
- Budget improvements start with transaction edit/delete (smallest valuable thing for the sister-user case)

---

## Work Item 1: Wishlist / Lists robustness

### Schema migration `supabase/migrations/013_list_items_extras.sql`

```sql
alter table public.list_items
  add column due_date date,
  add column importance smallint check (importance between 1 and 3);
```

`importance`: 1 = low, 2 = medium, 3 = high. Null = unset (most items).

### Files to modify

- `app/components/lists/ListItemRow.tsx` — add date display (small badge if due, red if overdue), add importance indicator (1–3 colored dots or filled-stars). In the edit mode form, add a date input and a 3-button importance picker.
- `app/components/lists/ListDetailView.tsx`:
  - Add `[Hide done] / [Show done]` toggle near the "Done · N" header. Default: collapsed. Persist preference in localStorage per list.
  - Sort active items by: importance DESC (nulls last), then due_date ASC (nulls last), then created_at ASC.
- `app/lists/page.tsx` — list cards already show progress; no changes needed.

### Done items collapsable behavior

When collapsed: show "Done · 3 (show)" as a button. Click expands inline. Persist `wooli_list_${id}_show_done` in localStorage.

### Sort ordering (active items only)

```ts
items.sort((a, b) => {
  const impA = a.importance ?? 0
  const impB = b.importance ?? 0
  if (impA !== impB) return impB - impA
  const dueA = a.due_date || '9999-12-31'
  const dueB = b.due_date || '9999-12-31'
  if (dueA !== dueB) return dueA.localeCompare(dueB)
  return a.created_at.localeCompare(b.created_at)
})
```

---

## Work Item 2: Calendar UI — emojis & layout

### What changes

- Replace activity dots in `LifeCalendar` cells with emojis from `ACTIVITY_CONFIG[name].emoji`
- Spread emojis full-width along the bottom of the cell (above the period flow bar if present)
- Show all activities (don't cap at 4)
- Reorder legend: **Mood** row first, **Activity** row second, **Period markers** last. Keep "Has notes" key on the activity line.

### Files to modify

- `app/components/dashboard/LifeCalendar.tsx`:
  - In each cell, replace the `<div className="absolute left-1 right-1 bottom-2 flex gap-0.5 justify-center">` block. New version: `flex justify-around` to spread emojis edge-to-edge. Use `text-[10px] leading-none` for size. Bottom offset moves to `bottom-1.5` so emojis sit above the 3px period bar.
  - Each emoji renders as `<span aria-label={activityName}>{ACTIVITY_CONFIG[a].emoji}</span>` — no background color.
  - In the legend section, reorder rows: mood / activities / periods. Replace the colored dot in the activity legend with the emoji itself.

### Notes

- Emojis already defined: 🏃 Exercised, 📖 Read, 😴 Good sleep, 🧘 Meditated.
- The cell is `aspect-square` and small (~40px on desktop). 4 emojis at 10px should fit comfortably edge-to-edge. If it looks cramped, drop to `text-[9px]`.

---

## Work Item 3: Budget transaction tracking — edit and delete

This is the start of making Budget more robust for the sister-user case. Just edit/delete for v1; defer recurring transactions, search filters, and date-range views to a later session.

### What changes

- Add transaction edit page: `/budget/[id]/page.tsx` with a form pre-filled from the existing transaction
- Add inline delete on transaction rows in `TransactionList.tsx`
- Reuse `TransactionForm.tsx` — extend it to accept an optional `transaction` prop and call `update` instead of `insert` when editing

### Schema

No schema changes needed. `transactions` table already has all needed fields.

### Files to modify

- `app/components/budget/TransactionForm.tsx` — add `transaction?: ExistingTransaction` prop; if present, use update path; relabel button "Save changes" vs "Save Transaction"
- `app/components/budget/TransactionList.tsx` — wrap each row in a `<Link href={`/budget/${t.id}`}>` for edit. Add a small ✕ delete button on hover (reuse the pattern from `ListItemRow.tsx`). Confirm via `confirm()` for now (no toast yet).

### Files to create

- `app/budget/[id]/page.tsx` — server component. Fetch the transaction by id (with user_id filter for RLS), pass to `TransactionForm` with the existing-transaction prop. Add breadcrumbs `[Budget, Edit transaction]`.

### Out of scope (defer)

- Recurring transactions
- Search/filter UI
- Date range navigation (prev/next month)
- Bulk operations
- CSV import

---

## Suggested order

1. Read this spec + the two module docs
2. Apply migration 013 via Supabase MCP
3. Work Item 2 first (Calendar UI — smallest, no schema, validates the read-only-files-listed approach)
4. Work Item 1 (Lists robustness — needs migration, more files)
5. Work Item 3 (Budget edit/delete)
6. `npm run build`, commit, push

## Verification

- Build passes (`npm run build`)
- `/lists/[id]`: add a high-importance item with a future due date; it sorts to top. Toggle done — disappears under "Done (show)". Click show — expands.
- `/`: dashboard calendar shows emojis spread along bottom of cells with mood entries; legend ordered Mood → Activity → Period
- `/budget`: click a transaction → edit page loads pre-filled → save → returns to list with updated value. Click ✕ → confirm → row gone.
- Push to main → Vercel auto-deploys.

## Token budget guidance

This whole spec is sized to fit comfortably in one Sonnet session at ~30–40% budget if Sonnet:
- Reads only the files listed
- Does NOT spawn an Explore agent (everything you need is here)
- Does NOT re-read other modules' source
- Skips `npm install` (no new deps needed)

If something feels missing from this spec, ask the user before fanning out into the codebase.
