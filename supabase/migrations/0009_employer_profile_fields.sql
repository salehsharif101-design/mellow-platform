-- Adds richer employer profile fields for the redesigned onboarding flow
-- (typical roles hired for, a short company highlight, and a logo) plus
-- storage policies for the "company-logos" bucket
-- (created separately via the Storage API, same as "avatars").

alter table public.employer_profiles
  add column typical_roles text,
  add column company_highlight text,
  add column logo_url text;

create policy "employers upload own logo"
  on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "employers manage own logo"
  on storage.objects for update
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "employers delete own logo"
  on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anyone can view company logos"
  on storage.objects for select
  using (bucket_id = 'company-logos');
