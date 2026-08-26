-- Undoes 0050_calendly_oauth.sql — the Calendly OAuth integration was
-- replaced with simpler employer-side tracking (a meetings row recorded
-- directly when an employer clicks "Book a meeting" on a candidate's
-- public profile, instead of a per-candidate Calendly webhook). 0050 is
-- kept as historical record rather than deleted, since it was already
-- applied to this database — this migration drops what it created instead.
--
-- calendly_event_uri also goes: it existed purely as the webhook's own
-- dedup key (Calendly's event identifier), which has no equivalent once
-- there's no webhook populating it.
--
-- The new insert policy is what lets an employer record their own
-- "Book a meeting" click directly from the client (src/pages/candidate/
-- PublicProfile.jsx) — meetings previously only had select policies,
-- written to exclusively by the (now-removed) webhook's service-role
-- client.

drop table public.calendly_tokens;

alter table public.candidate_profiles
  drop column calendly_connected,
  drop column calendly_username;

alter table public.meetings
  drop column calendly_event_uri;

create policy "employers can record a meeting booking"
  on public.meetings for insert
  with check (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));
