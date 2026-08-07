-- Adds the richer "profile story" fields used by the redesigned onboarding
-- flow: current company, a three-word self-description, something the
-- candidate is proud of, availability, and preferred work style.
-- (calendly_url already exists from migration 0003, so it's not repeated here.)

alter table public.candidate_profiles
  add column current_company text,
  add column three_words text,
  add column proud_of text,
  add column availability text,
  add column work_style text[] not null default '{}';
