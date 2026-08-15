-- The original insert policy (`auth.role() = 'authenticated'`, migration
-- 0003) rejects inserts from genuinely signed-in users on this project —
-- reproduced directly against the DB with a real user's access token, code
-- 42501. `auth.uid() is not null` is the standard, reliable check for "is
-- signed in" and is what the digest feature's view-tracking depends on.
drop policy if exists "signed-in users can record a profile view" on public.profile_views;

create policy "signed-in users can record a profile view"
  on public.profile_views for insert
  with check (auth.uid() is not null);
