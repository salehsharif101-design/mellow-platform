-- Adds an optional "year established" to employer profiles, shown as
-- "Est. 2018" on the public company page and counted towards the dashboard's
-- profile-strength score.
--
-- The company profile table is employer_profiles (there is no "employers"
-- table). The "not in the future" rule lives in the app, where "now" is
-- known — a CHECK against the current year would make this row
-- non-restorable once the year rolls over; the database only guarantees a
-- sane 4-digit value.

alter table public.employer_profiles
  add column year_established integer
  check (year_established is null or year_established between 1000 and 9999);

-- Grants, per the pattern in 0085. employer_profiles already exists, so the
-- 2026-10-30 Data API change doesn't affect it and adding a column needs no
-- grant of its own; these restate the access the table already has (RLS
-- still does the per-row filtering) so this migration is self-contained.
grant select on public.employer_profiles to anon;
grant select, insert, update, delete on public.employer_profiles to authenticated;
grant select, insert, update, delete on public.employer_profiles to service_role;
