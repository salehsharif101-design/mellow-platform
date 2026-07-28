-- Adds support for: the work-video library, Calendly booking links, and
-- profile-view tracking for the candidate dashboard. Run in the Supabase
-- SQL Editor.

alter table public.candidate_profiles
  add column calendly_url text;

create table public.candidate_videos (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  label text not null,
  video_url text not null,
  created_at timestamptz not null default now()
);

create index on public.candidate_videos (candidate_id);

alter table public.candidate_videos enable row level security;

create policy "candidates manage own work videos"
  on public.candidate_videos for all
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()))
  with check (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));

create policy "anyone can read work videos of live candidates"
  on public.candidate_videos for select
  using (candidate_id in (select id from public.candidate_profiles where is_live = true));

create table public.profile_views (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  viewer_id uuid references public.users (id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index on public.profile_views (candidate_id);

alter table public.profile_views enable row level security;

create policy "candidates read own profile views"
  on public.profile_views for select
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));

create policy "signed-in users can record a profile view"
  on public.profile_views for insert
  with check (auth.role() = 'authenticated');
