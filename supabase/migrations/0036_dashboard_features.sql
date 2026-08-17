-- Supports several employer-dashboard features in one pass:
--   1. Role page view tracking, for the view→apply conversion insight.
--   2. A status field on shortlists themselves (independent of any
--      per-role application status, since a shortlisted candidate may
--      never have applied to a specific role) for the full-screen
--      candidate review mode.
--   3. Company profile view tracking, for the "talent viewed your
--      company profile" activity feed item.

alter table public.roles
  add column view_count integer not null default 0;

-- Security definer so an anonymous or candidate visitor can increment the
-- counter without needing a broad public UPDATE policy on the roles table
-- (which would otherwise expose every other column to public writes).
create or replace function public.increment_role_view(role_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.roles set view_count = view_count + 1 where id = role_id;
$$;

revoke execute on function public.increment_role_view(uuid) from public;
grant execute on function public.increment_role_view(uuid) to anon, authenticated;

alter table public.shortlists
  add column status text not null default 'shortlisted';

create table public.company_views (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  viewer_id uuid references public.users (id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index on public.company_views (employer_id);

alter table public.company_views enable row level security;

create policy "employers read own company views"
  on public.company_views for select
  using (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));

-- auth.uid() is not null (rather than auth.role() = 'authenticated') per
-- the fix already applied to profile_views' equivalent policy — see
-- migration 0034.
create policy "signed-in users can record a company view"
  on public.company_views for insert
  with check (auth.uid() is not null);
