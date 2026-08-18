-- Adds an optional company headline, mirroring the candidate headline
-- added in migration 0040.

alter table public.employer_profiles
  add column headline text;
