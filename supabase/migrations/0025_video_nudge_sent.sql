-- Tracks whether the first-role company video nudge email has ever been
-- sent to this employer, so deleting and reposting a role can't trigger it
-- again.
alter table public.employer_profiles
  add column video_nudge_sent boolean not null default false;
