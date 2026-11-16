-- Backs the one-time "Your application is no longer visible to employers"
-- email (api/cron/removed-video-reminder.js), sent to a candidate who has
-- applied to a role but whose profile is no longer live because their intro
-- video was removed. The cron claims this flag with a conditional update
-- (removed_video_reminder_sent = false) before sending, the same pattern as
-- the other one-time "*_sent" flags on this table, so overlapping runs can't
-- double-send and a candidate only ever gets it once.
--
-- Adds a column to an existing table, so no new grants are needed.
-- Defaults to false for every existing row.

alter table public.candidate_profiles
  add column if not exists removed_video_reminder_sent boolean not null default false;
