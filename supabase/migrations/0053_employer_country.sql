-- Adds an optional company country, shown on the public company profile
-- alongside industry and company size, mirroring headline (0041).

alter table public.employer_profiles
  add column country text;
