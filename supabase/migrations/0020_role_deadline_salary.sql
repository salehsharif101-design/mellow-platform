-- Optional application deadline and salary range fields for roles.
create type salary_currency as enum ('BHD', 'AED', 'SAR', 'USD');

alter table public.roles
  add column deadline date,
  add column salary_min integer,
  add column salary_max integer,
  add column salary_currency salary_currency;
