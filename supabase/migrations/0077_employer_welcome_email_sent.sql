-- Mirrors migration 0060's candidate_profiles.welcome_email_sent. Without
-- this, sendEmployerWelcome (api/email.js) had no atomic claim at all — two
-- near-simultaneous onboarding-completion submissions for the same employer
-- (e.g. two open tabs) would each read the client-side wasIncomplete flag
-- as true and both call notify('employer-welcome', ...), sending two
-- identical "Welcome to Mellow" emails. This column lets the send be
-- claimed atomically server-side instead of trusting client state.
alter table public.employer_profiles
  add column welcome_email_sent boolean not null default false;
