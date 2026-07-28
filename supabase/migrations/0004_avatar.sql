-- Adds a profile picture field for candidates, backed by a new public
-- "avatars" storage bucket (created separately via the Storage API).
-- Run in the Supabase SQL Editor.

alter table public.candidate_profiles
  add column avatar_url text;

create policy "candidates upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "candidates manage own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "candidates delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
