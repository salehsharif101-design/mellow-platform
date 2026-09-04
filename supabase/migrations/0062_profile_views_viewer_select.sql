-- PublicProfile.jsx's view-tracking now checks for an existing view from
-- the same viewer in the last 24h before inserting a new one, so an
-- employer refreshing a candidate's page repeatedly doesn't inflate their
-- "profile views" stat with one row per load. That dedupe check selects
-- profile_views by viewer_id — but the only existing SELECT policy lets a
-- candidate read views of their OWN profile, not a viewer read back the
-- views they themselves recorded, so the check silently saw nothing and
-- the dedupe never actually took effect. This adds the missing half.

create policy "viewers can read their own recorded views"
  on public.profile_views for select
  using (viewer_id = auth.uid());
