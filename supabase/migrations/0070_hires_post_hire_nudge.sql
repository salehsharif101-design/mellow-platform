-- api/cron/post-hire-nudge.js sends a candidate a one-time "how's the new
-- role going" check-in 10 days after they confirm a hire (hires.confirmed_at,
-- set by api/meeting-outcome.js's 'hire_accepted' action — the only path
-- that ever inserts a hires row, reached from the candidate clicking
-- "Yes, I got the role" in the hire-confirmation email). This flag is what
-- keeps that a one-time send.
alter table public.hires
  add column post_hire_nudge_sent boolean not null default false;
