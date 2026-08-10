-- Optional company intro video ("Meet the team"), shown on the public role
-- page. The company-videos bucket itself was created via the Storage API
-- (public bucket, 50MB limit, same pattern as candidate-videos/avatars/
-- company-logos — see project notes); this migration adds its RLS policies.
alter table public.employer_profiles
  add column intro_video_url text;

create policy "employers upload own intro video"
  on storage.objects for insert
  with check (
    bucket_id = 'company-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "employers manage own intro video"
  on storage.objects for update
  using (
    bucket_id = 'company-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "employers delete own intro video"
  on storage.objects for delete
  using (
    bucket_id = 'company-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Scoped to the uploader's own folder (not bucket-wide) so ON CONFLICT
-- upserts keep working (see migration 0014) without anon being able to list
-- other companies' videos.
create policy "employers can view own intro video"
  on storage.objects for select
  using (
    bucket_id = 'company-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
