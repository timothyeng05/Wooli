# Budget — Settings

Monarch-style centralized settings hub for the Budget module. Sub-nav shell at
`app/budget/settings/layout.tsx` with two tabs today: Categories and Institutions.
`/budget/settings` itself redirects to `/budget/settings/categories`.

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/settings` | `app/budget/settings/page.tsx` | Redirects to `/budget/settings/categories` |
| `/budget/settings/categories` | `app/budget/settings/categories/page.tsx` | Category tree editor — moved here from `/budget/categories` (see `docs/budget/categories.md`) |
| `/budget/settings/institutions` | `app/budget/settings/institutions/page.tsx` | Per-institution custom logo upload |

## Components

| File | Purpose |
|------|---------|
| `InstitutionsManager.tsx` | Lists every institution name in use (from `bank_connections` + manual `accounts.institution`), lets the user upload a photo per institution |
| `CategoryManager.tsx` | Unchanged — see `docs/budget/categories.md` |

## Schema

```sql
-- One custom logo per institution name per user, reused across every
-- account (synced or manual) under that institution.
institution_logos (id, user_id, institution_name, logo_url, created_at, updated_at;
                    unique(user_id, institution_name))

-- Storage bucket 'institution-logos' (public read), object path convention:
-- {user_id}/{sanitized-institution-name}-{timestamp}.{ext}
```

## Key notes

- Institution list is *derived*, not stored — it's the distinct set of `bank_connections.institution_name` and active `accounts.institution` values. An institution with no account attached to it won't appear, and there's currently no way to pre-add one before connecting an account.
- Logo resolution order (in `InstitutionLogo.tsx`): `customUrl` prop (from `institution_logos`, looked up by institution name in `app/budget/accounts/page.tsx`) → built-in `KNOWN_INSTITUTIONS`/`LOGO_MAP` regex match → nothing (renders null).
- The old per-account `accounts.logo_url` column (migration 042) is unused now — logos are institution-keyed, not account-keyed. Column left in place, not dropped.
- Storage upload path is `{user_id}/...` specifically so the RLS policies (`(storage.foldername(name))[1] = auth.uid()::text`) can scope writes to the owning user.
