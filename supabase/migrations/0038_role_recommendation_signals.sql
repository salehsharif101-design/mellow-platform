-- Two new signals the Browse Roles recommendation algorithm needs but that
-- weren't previously captured anywhere: whether a role has a specific work
-- style (vs. being open to any), and whether the employer has flagged it as
-- urgent to fill.

alter table public.roles
  add column work_style text,
  add column is_urgent boolean not null default false;
