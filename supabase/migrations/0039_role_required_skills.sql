-- Adds a structured skills field to roles, mirroring
-- candidate_profiles.skills, so Browse Roles search and the recommendation
-- algorithm can match against real skill tags instead of relying on
-- free-text description matching.

alter table public.roles
  add column required_skills text[] not null default '{}';
