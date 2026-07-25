-- Lets a user set a custom logo URL for any manual account, instead of being
-- limited to the hardcoded KNOWN_INSTITUTIONS/LOGO_MAP list in
-- InstitutionLogo.tsx (which has no entry for e.g. car manufacturers).

alter table public.accounts add column if not exists logo_url text;
