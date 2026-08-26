-- Backs the second employer follow-up email, sent 14 days after an
-- employer clicks "Still in progress" on the first follow-up
-- (api/cron/meeting-follow-up.js's new sendSecondFollowUps).
--
-- still_in_progress_at is stamped only by the "still_deciding" action
-- (api/meeting-outcome.js) specifically, separately from the existing
-- outcome_recorded_at — outcome_recorded_at is shared with the candidate's
-- "not yet" action and feeds the unrelated 7-day talent nudge, so it can't
-- be reused here without also nudging on a candidate decline, which this
-- email is not about.
--
-- not_this_time_at closes the loop when the employer responds to the
-- second follow-up with "Not this time" — no further emails follow.
alter table public.meetings
  add column still_in_progress_at timestamptz,
  add column second_followup_sent boolean not null default false,
  add column not_this_time_at timestamptz;
