-- Adds a Calendly link field to employer_profiles, mirroring the same field
-- candidates already have (calendly_url from migration 0003), for the new
-- employer Edit Profile page.
alter table public.employer_profiles
  add column calendly_url text;
