-- Tracks the "your Mellow profile is yours to share" emails (the 36-hour
-- welcome for new candidates and the one-time re-engagement send to
-- existing ones). One timestamp for both: a candidate gets at most one of
-- them, ever, and each sender claims the row with a conditional update
-- (profile_link_email_sent_at is null) before sending, the same pattern as
-- welcome_email_sent, so overlapping runs can't double-send.
--
-- Adds columns to an existing table, so no new grants are needed.

alter table public.candidate_profiles
  add column if not exists profile_link_email_sent_at timestamptz,
  add column if not exists profile_link_email_kind text
    check (profile_link_email_kind is null or profile_link_email_kind in ('welcome', 'reengagement'));
