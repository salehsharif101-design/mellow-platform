-- Adds an optional education background section to candidate_profiles, for
-- the onboarding Basics step, Edit Profile, and the public profile page.
alter table public.candidate_profiles
  add column education_level text,
  add column field_of_study text,
  add column institution_name text,
  add column graduation_year integer;
