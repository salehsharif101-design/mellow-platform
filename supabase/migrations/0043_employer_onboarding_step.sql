-- Mirrors candidate_profiles.onboarding_step: tracks whether an employer has
-- actually finished the onboarding form (2) vs. still has it in progress
-- (1, the default), independent of whether company_name happens to be set
-- from an autosaved draft. Run this in the Supabase SQL Editor.

alter table public.employer_profiles
  add column onboarding_step smallint not null default 1;
