-- Tracks which onboarding step a candidate last completed (1-5), so the
-- wizard can resume exactly where they left off, including through the
-- optional "skip" on the LinkedIn step. Run this in the Supabase SQL Editor.

alter table public.candidate_profiles
  add column onboarding_step smallint not null default 1;
