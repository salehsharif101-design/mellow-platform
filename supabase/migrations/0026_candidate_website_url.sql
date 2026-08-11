-- Adds a portfolio/personal website link field to candidate_profiles, for
-- the candidate Edit Profile Links section (linkedin_url, calendly_url).
alter table public.candidate_profiles
  add column website_url text;
