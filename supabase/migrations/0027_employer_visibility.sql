-- Lets admins hide an employer from candidate-facing discovery (browse
-- roles, company profile page, individual role pages) without deleting
-- their account, mirroring the moderation intent of candidates' is_live.
alter table public.employer_profiles
  add column is_visible boolean not null default true;
