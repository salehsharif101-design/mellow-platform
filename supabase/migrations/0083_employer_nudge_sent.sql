-- Tracks whether the one-time "Your Mellow company profile is waiting for
-- you" nudge (api/cron/employer-onboarding-dropoff-nudge.js) has gone out to
-- this employer, so it fires at most once no matter how many times the cron
-- runs.
alter table public.employer_profiles
  add column employer_nudge_sent boolean not null default false;

-- Every employer that exists right now with onboarding_completed_at null is
-- a legacy account, not an abandoned signup: that column was only added in
-- migration 0047, so accounts that finished onboarding before it existed
-- never got stamped, even though they have a full profile, posted roles, and
-- teammates. Marking them as already nudged keeps a "you didn't finish
-- setting up" email from going to active customers on the cron's first run;
-- only employers who sign up from here on are ever eligible.
update public.employer_profiles
set employer_nudge_sent = true
where onboarding_completed_at is null;
