# Wooli Development Lessons Learned

## Session 1 (Auth Flow + Mood Module)

### 1. Database Triggers Are Essential for Auth Flow
**Issue:** User could sign up and log in, but `profiles` table never auto-created.
**Why:** Missing `handle_new_user()` trigger on `auth.users`.
**Fix:** Always create triggers immediately after table creation:
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```
**Next time:** Include all migrations in initial database setup, don't skip.

---

### 2. Separate Supabase Client Imports by Context
**Issue:** Client components couldn't import from `lib/supabase.ts` (which imports `next/headers`).
**Error:** "next/headers API is only available in Server Components"
**Fix:** Split into two files:
- `lib/supabase-client.ts` — only `createClient()` for client components
- `lib/supabase-server.ts` — only `createServerSupabaseClient()` for server components

**Next time:** Create separate imports from the start, not after refactoring.

---

### 3. Server vs Client Component Boundaries
**Pattern:**
- **Server components** (`app/*/page.tsx`): Auth checks, data fetching, redirects
- **Client components** (`components/*Client.tsx`): Form handling, state, interactivity

**Bad:** Passing `onSubmit` prop that uses server-only code
**Good:** Client component imports `createClient` and handles database calls itself

---

### 4. Middleware Deprecation
**Warning:** `middleware.ts` file convention is deprecated in favor of "proxy"
**Next time:** Update middleware to new convention when time permits. For now, it works but expect breaking changes in Next.js 17+.

---

### 5. Establish Branding Early
**What worked:** Setting up Tailwind `primary-*` color palette and "Wooli" branding before building modules.
**Why:** All components use consistent colors without rework. Easier for user to see final product.
**Next time:** Create design tokens (colors, spacing, typography) in Tailwind config first, then build.

---

### 6. Start with One Complete Module
**Path:** Build Mood module fully (create → list → detail) before starting Budget.
**Why:** Establishes the pattern that all other modules follow. Validates architecture with real code.
**Not:** Building all 4 module skeletons. Too abstract, hard to find errors.

---

### 7. Database First, Then App Code
**Order:**
1. Create all tables + migrations in Supabase
2. Test with migrations.md SQL
3. Build app routes + components

**Why:** Catch schema issues (missing columns, RLS policies) before writing form code.

---

## Checklist for Next Modules (Budget, Cards, Calendar)

- [ ] Run all SQL migrations in order (create table → trigger → RLS)
- [ ] Test RLS: log in as different user, verify they can't see other users' data
- [ ] Server component for fetching (e.g., `/budget/page.tsx`)
- [ ] Client component for forms (e.g., `BudgetFormClient.tsx`)
- [ ] Link new module to dashboard widget
- [ ] Import from `supabase-client` in client components, `supabase-server` in server
- [ ] Update middleware matcher if needed (likely not)

---

## Known Issues to Watch

1. **Middleware deprecation** — Next.js will move to `proxy` in future releases
2. **Email in profiles** — Currently stored in both `auth.users` and `profiles` (denormalization for convenience)
3. **No image uploads yet** — Avatar URLs are text placeholders, no Supabase Storage integration

