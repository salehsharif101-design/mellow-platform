-- Backs the one-time "Post your first role on Mellow" email
-- (api/cron/employer-no-role-reminder.js), sent to an employer who completed
-- onboarding at least 48 hours ago but has never posted a role. The cron
-- claims this flag with a conditional update (no_role_reminder_sent = false)
-- before sending, the same pattern as the other one-time "*_sent" flags on
-- this table, so overlapping runs can't double-send and an employer only
-- ever gets it once.
--
-- Adds a column to an existing table, so no new grants are needed.
-- Defaults to false for every existing row.

alter table public.employer_profiles
  add column if not exists no_role_reminder_sent boolean not null default false;
