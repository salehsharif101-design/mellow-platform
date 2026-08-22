-- Backs the delayed "check out their work videos" nudge email, sent once to
-- an employer 24 hours after they finish onboarding (see
-- api/cron/work-video-nudge.js). onboarding_completed_at is the timestamp
-- the cron measures the 24-hour delay from - only ever stamped on the
-- employer's first onboarding submission (Onboarding.jsx), not on later
-- profile edits, so it stays a stable "when they finished" marker.
-- work_video_nudge_sent guarantees a single send per employer, mirroring
-- video_nudge_sent from 0025.

alter table public.employer_profiles
  add column onboarding_completed_at timestamptz,
  add column work_video_nudge_sent boolean not null default false;
