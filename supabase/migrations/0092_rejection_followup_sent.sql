-- Backs the one-time "Don't let rejection stop you" email
-- (api/cron/rejection-followup.js), sent to a candidate 24-72 hours after
-- their first rejection. The cron claims this flag with a conditional update
-- (rejection_followup_sent = false) before sending, the same pattern as the
-- other one-time "*_sent" flags on this table, so overlapping runs can't
-- double-send and a candidate only ever gets it once.
--
-- Adds a column to an existing table, so no new grants are needed.
-- Defaults to false for every existing row.

alter table public.candidate_profiles
  add column if not exists rejection_followup_sent boolean not null default false;
