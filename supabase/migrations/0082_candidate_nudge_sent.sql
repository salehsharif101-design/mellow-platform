-- Tracks whether the one-time "Your Mellow profile is waiting for you" nudge
-- (api/cron/onboarding-dropoff-nudge.js) has gone out to this candidate, so
-- it fires at most once no matter how many times the cron runs.
alter table public.candidate_profiles
  add column nudge_sent boolean not null default false;
