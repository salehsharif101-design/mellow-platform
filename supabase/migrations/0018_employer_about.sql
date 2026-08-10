-- Short public-facing company description, shown on the public role page.
-- Distinct from culture_description (an onboarding-only field never shown
-- publicly) — capped at 300 chars, enforced client-side same as
-- company_highlight.
alter table public.employer_profiles
  add column about text;
