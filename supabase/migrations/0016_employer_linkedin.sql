-- Replaces the employer Calendly field with a LinkedIn company page URL.
-- Uses "if exists"/"if not exists" so this runs cleanly regardless of
-- whether migration 0015 (calendly_url) actually landed.
alter table public.employer_profiles
  drop column if exists calendly_url;

alter table public.employer_profiles
  add column if not exists linkedin_url text;
