-- handleBookMeeting (src/pages/candidate/PublicProfile.jsx) only ever
-- guarded against a duplicate booking with a client-side read-then-insert
-- (checking for a recent row, then inserting) — no DB constraint backed it
-- up after migration 0051 dropped the old calendly_event_uri unique key
-- along with the webhook flow it belonged to. A double-click (or two
-- near-simultaneous requests) could pass the read check twice and insert
-- two meetings rows for the same employer/candidate pair, each
-- independently and correctly triggering its own 7-days-later follow-up
-- email once meeting-follow-up.js's own (already-atomic) claim picks it up.
--
-- Scoped to the same calendar day (not a permanent one-row-ever constraint)
-- to match the client's own 24h re-book window — an employer genuinely
-- booking again with the same candidate next week must still be allowed.
--
-- Plain `booking_created_at::date` can't be used directly in an index
-- expression: casting a timestamptz to date depends on the session's
-- timezone setting, so Postgres marks it STABLE, and an index expression
-- must be IMMUTABLE. Pinning the conversion to a fixed 'utc' offset makes
-- the result genuinely input-only-dependent, so wrapping it in our own
-- function marked immutable is safe (the standard workaround for this).
create or replace function public.utc_date(ts timestamptz)
returns date
language sql
immutable
as $$
  select (ts at time zone 'utc')::date
$$;

create unique index meetings_employer_candidate_same_day_idx
  on public.meetings (employer_id, candidate_id, public.utc_date(booking_created_at));
