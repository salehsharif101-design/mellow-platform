-- Adds an optional years-of-experience field to candidate_profiles, shown
-- in onboarding Step 1, Edit Profile, the public profile, and talent feed
-- cards. Stored as free text but the app only ever writes one of a fixed
-- set of values ('Less than 1 year', '1-3 years', '3-5 years', '5-10
-- years', '10+ years'), same convention as availability/education_level.
alter table public.candidate_profiles
  add column years_of_experience text;
