-- Backs the one-time "You're one step away from hiring on Mellow" email
-- (api/cron/employer-onboarding-reminder.js), sent to an employer who
-- created an account but never completed onboarding, so never got the
-- welcome email. The cron claims this flag with a conditional update
-- (onboarding_reminder_sent = false) before sending, the same pattern as the
-- other one-time "*_sent" flags on this table, so overlapping runs can't
-- double-send and an employer only ever gets it once.
--
-- Adds a column to an existing table, so no new grants are needed.
-- Defaults to false for every existing row.

alter table public.employer_profiles
  add column if not exists onboarding_reminder_sent boolean not null default false;
