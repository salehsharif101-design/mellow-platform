-- Tracks whether the "Welcome to Mellow" email (see api/email.js's
-- candidate-welcome case and api/cron/welcome-email-nudge.js) has been sent
-- to this candidate, so it fires exactly once no matter which of the two
-- triggers gets there first: landing on the dashboard with a fully live
-- profile, or the 24h nudge cron catching anyone who confirmed their email
-- but never made it back to finish onboarding.
alter table public.candidate_profiles
  add column welcome_email_sent boolean not null default false;
