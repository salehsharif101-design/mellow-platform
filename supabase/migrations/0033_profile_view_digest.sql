-- Profile views moved from an immediate per-view email to a daily digest.
-- Tracks when each candidate's last digest was sent so the cron job can
-- gate re-sends and the digest body can report a meaningful count.
alter table public.candidate_profiles
  add column last_digest_sent_at timestamptz;
