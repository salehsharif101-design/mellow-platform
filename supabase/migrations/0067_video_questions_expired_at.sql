-- Records exactly when the expiry cron flipped a question to 'expired', so
-- the employer "what's new" feed (a computed, timestamp-filtered read, not
-- a persisted notification table — see answered_at's identical role there)
-- can tell a genuinely new expiry from one that happened days ago.
alter table public.video_questions add column expired_at timestamptz;
