-- Fixes "new row violates row-level security policy" on avatar, intro video,
-- work video, and company logo uploads (all four call sites in the app use
-- supabase.storage.upload(path, file, { upsert: true })).
--
-- Root cause: migration 0011 dropped the "anyone can view X" SELECT policies
-- on storage.objects to stop anon from listing bucket contents. But Supabase
-- Storage implements upsert as an INSERT ... ON CONFLICT DO UPDATE, and
-- Postgres requires SELECT-level RLS visibility on the (potentially)
-- conflicting row for that to plan at all — with zero SELECT policy left on
-- these buckets, every upsert-mode upload started failing for every user,
-- not just anon (verified live: the exact same upload succeeds without the
-- x-upsert header, and fails with it, for a freshly authenticated user
-- uploading to their own folder).
--
-- Fix: restore SELECT, but scoped to the uploader's own folder instead of
-- the previous bucket-wide grant. This satisfies the ON CONFLICT visibility
-- requirement (a user can always see their own files) while keeping anon's
-- ability to enumerate OTHER users' files closed, since
-- (storage.foldername(name))[1] = auth.uid()::text can never match for an
-- unauthenticated request.
create policy "candidates can view own videos"
  on storage.objects for select
  using (bucket_id = 'candidate-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "candidates can view own avatar"
  on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "employers can view own logo"
  on storage.objects for select
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);
