-- Optional nationality field on a candidate's profile, shown on their
-- public profile next to location and editable from both the Edit Profile
-- page and onboarding's Basics step. Uses the same free-text-with-datalist
-- country autocomplete already used for employer_profiles.country (see
-- migration 0053) rather than a constrained type, for the same reason:
-- simple, no extra validation surface, and consistent with that existing
-- pattern.
alter table public.candidate_profiles
  add column nationality text;
