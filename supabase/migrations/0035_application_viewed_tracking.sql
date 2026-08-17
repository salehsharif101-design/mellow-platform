-- Tracks the moment an employer first opens a candidate's profile from the
-- applicant list, so unviewed applicants can be highlighted individually and
-- counted on the employer dashboard's per-role pipeline cards.
alter table public.applications
  add column viewed_at timestamptz;
