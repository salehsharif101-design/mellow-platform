-- Backs the "save my profile and come back later" onboarding path
-- (src/pages/candidate/ProfileEdit.jsx, Step5Video.jsx) and its follow-up
-- reminder email sequence (api/cron/video-reminder.js).
--
-- video_reminder_started_at is stamped once, the first time a candidate
-- saves their profile at the video step without uploading one — it's the
-- baseline the cron measures the 24h/72h/7d reminder delays from. It is
-- never reset on later "save for later" clicks, so revisiting the step
-- doesn't buy a candidate a fresh set of reminder deadlines.
--
-- video_reminder_sent_count tracks how many of the three reminder emails
-- have gone out (0-3), so each one only ever sends once, in order.

alter table public.candidate_profiles
  add column video_reminder_started_at timestamptz,
  add column video_reminder_sent_count smallint not null default 0;
