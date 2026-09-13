-- sendCustomStageNotification (api/email.js) previously deduped by counting
-- candidate_activity_log rows for this candidate+role that aren't a builtin
-- stage label — a read, not a claim. Two team members moving the same
-- candidate into a genuine custom stage at nearly the same instant could
-- both read the same (pre-update) count and both send the "your
-- application is progressing" email. applications already has a unique
-- (candidate_id, role_id) constraint (migration 0001), so this column,
-- claimed the same atomic-conditional-update way as the welcome emails,
-- gives the send itself something to claim instead of just counting logs.
alter table public.applications
  add column custom_stage_notified_at timestamptz;
