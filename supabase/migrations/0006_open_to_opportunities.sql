-- Lets a candidate hide their (otherwise live) profile from the employer
-- talent feed without taking their profile down entirely.

alter table public.candidate_profiles
  add column is_open_to_opportunities boolean not null default true;
