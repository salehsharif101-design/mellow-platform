-- Mellow platform schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`).

-- ── Enums ─────────────────────────────────────────────────────────────────

create type user_type as enum ('candidate', 'employer');
create type role_type as enum ('full-time', 'part-time', 'contract', 'freelance');
create type application_status as enum ('applied', 'shortlisted', 'contacted', 'hired');
create type language_proficiency as enum ('basic', 'conversational', 'fluent', 'native');

-- ── Tables ────────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  user_type user_type not null,
  created_at timestamptz not null default now()
);

create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  full_name text,
  job_title text,
  location text,
  bio text,
  linkedin_url text,
  skills text[] not null default '{}',
  languages jsonb not null default '[]', -- [{ language, proficiency }]
  intro_video_url text,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table public.employer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_name text,
  industry text,
  company_size text,
  website_url text,
  culture_description text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  title text not null,
  location text,
  role_type role_type not null,
  description text,
  what_matters text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  status application_status not null default 'applied',
  applied_at timestamptz not null default now(),
  unique (candidate_id, role_id)
);

create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index on public.candidate_profiles (user_id);
create index on public.candidate_profiles (is_live);
create index on public.employer_profiles (user_id);
create index on public.roles (employer_id);
create index on public.roles (is_active);
create index on public.applications (candidate_id);
create index on public.applications (role_id);
create index on public.shortlists (employer_id);
create index on public.shortlists (candidate_id);
create index on public.messages (sender_id);
create index on public.messages (recipient_id);

-- ── auth.users -> public.users sync ─────────────────────────────────────
-- Reads the `user_type` passed in signUp({ options: { data: { user_type } } })

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, user_type)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'user_type')::user_type, 'candidate')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Row Level Security ───────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.applications enable row level security;
alter table public.shortlists enable row level security;
alter table public.messages enable row level security;

-- users: read own row only (row is created by the trigger, not the client)
create policy "users can read own row"
  on public.users for select
  using (id = auth.uid());

-- candidate_profiles: owner has full access; anyone can read live profiles
create policy "candidates manage own profile"
  on public.candidate_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "anyone can read live candidate profiles"
  on public.candidate_profiles for select
  using (is_live = true);

-- employer_profiles: owner has full access; any signed-in user can read
-- (needed to show company name/culture on role listings and talent feed)
create policy "employers manage own profile"
  on public.employer_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "signed-in users can read employer profiles"
  on public.employer_profiles for select
  using (auth.role() = 'authenticated');

-- roles: owning employer has full access; anyone can read active roles
create policy "employers manage own roles"
  on public.roles for all
  using (employer_id in (select id from public.employer_profiles where user_id = auth.uid()))
  with check (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));

create policy "anyone can read active roles"
  on public.roles for select
  using (is_active = true);

-- applications: candidate can create/read own; employer can read/update
-- applications to their own roles
create policy "candidates manage own applications"
  on public.applications for all
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()))
  with check (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));

create policy "employers read applications to their roles"
  on public.applications for select
  using (
    role_id in (
      select r.id from public.roles r
      join public.employer_profiles e on e.id = r.employer_id
      where e.user_id = auth.uid()
    )
  );

create policy "employers update applications to their roles"
  on public.applications for update
  using (
    role_id in (
      select r.id from public.roles r
      join public.employer_profiles e on e.id = r.employer_id
      where e.user_id = auth.uid()
    )
  );

-- shortlists: owning employer only
create policy "employers manage own shortlists"
  on public.shortlists for all
  using (employer_id in (select id from public.employer_profiles where user_id = auth.uid()))
  with check (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));

-- messages: sender and recipient can read; sender can insert; recipient can
-- mark as read
create policy "participants can read messages"
  on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "users can send messages"
  on public.messages for insert
  with check (sender_id = auth.uid());

create policy "recipient can mark message read"
  on public.messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ── Storage: candidate-videos bucket policies ───────────────────────────
-- The bucket itself is created via the Storage API (public bucket, 50MB
-- limit — see project notes). Candidates must upload into a folder named
-- after their own auth.uid(), e.g. `{uid}/intro.mp4`.

create policy "candidates upload own videos"
  on storage.objects for insert
  with check (
    bucket_id = 'candidate-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "candidates manage own videos"
  on storage.objects for update
  using (
    bucket_id = 'candidate-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "candidates delete own videos"
  on storage.objects for delete
  using (
    bucket_id = 'candidate-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anyone can view candidate videos"
  on storage.objects for select
  using (bucket_id = 'candidate-videos');
