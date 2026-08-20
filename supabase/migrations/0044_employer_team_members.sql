-- Lets an employer account owner invite teammates to manage the same
-- company account. Run this in the Supabase SQL Editor.

create table public.employer_team_members (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  -- Null until the invite is accepted, then set to the teammate's own auth
  -- user id. Kept separate from invited_email since the email alone isn't a
  -- stable identity (a user could theoretically change their auth email).
  user_id uuid references public.users (id) on delete cascade,
  invited_email text not null,
  status text not null default 'invited' check (status in ('invited', 'active')),
  invite_token uuid not null default gen_random_uuid(),
  invited_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (employer_id, invited_email)
);

create index on public.employer_team_members (employer_id);
create index on public.employer_team_members (user_id);
create index on public.employer_team_members (invite_token);

alter table public.employer_team_members enable row level security;

-- Resolves which employer_profiles a user can act on behalf of — the
-- company they own, plus any company where they're an active team member.
-- Used from roles/applications/shortlists/company_views policies so
-- teammates get the same access as the owner on those tables. Deliberately
-- NOT referenced from employer_profiles' or employer_team_members' own
-- policies, since employer_team_members' policies below already need to
-- read employer_profiles directly — routing that back through this
-- function (which itself reads employer_team_members) would recurse.
create or replace function public.employer_ids_for_user(uid uuid)
returns setof uuid
language sql
stable
as $$
  select id from public.employer_profiles where user_id = uid
  union
  select employer_id from public.employer_team_members where user_id = uid and status = 'active'
$$;

-- employer_team_members: the owner has full control (invite/remove/view).
-- A user can always see their own membership row. An invited user (matched
-- by email on their verified auth JWT, before they're linked to any
-- employer_id) can accept their own invite — and only their own.
create policy "owners manage team members"
  on public.employer_team_members for all
  using (employer_id in (select id from public.employer_profiles where user_id = auth.uid()))
  with check (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));

create policy "members can read own membership"
  on public.employer_team_members for select
  using (user_id = auth.uid());

create policy "invitee can accept own invite"
  on public.employer_team_members for update
  using (status = 'invited' and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (user_id = auth.uid() and status = 'active');

-- Widen roles/applications/shortlists/company_views so an active team
-- member has the same access as the owner, not just the owner themselves.

drop policy if exists "employers manage own roles" on public.roles;
create policy "employers manage own roles"
  on public.roles for all
  using (employer_id in (select public.employer_ids_for_user(auth.uid())))
  with check (employer_id in (select public.employer_ids_for_user(auth.uid())));

drop policy if exists "employers read applications to their roles" on public.applications;
create policy "employers read applications to their roles"
  on public.applications for select
  using (role_id in (select id from public.roles where employer_id in (select public.employer_ids_for_user(auth.uid()))));

drop policy if exists "employers update applications to their roles" on public.applications;
create policy "employers update applications to their roles"
  on public.applications for update
  using (role_id in (select id from public.roles where employer_id in (select public.employer_ids_for_user(auth.uid()))));

drop policy if exists "employers manage own shortlists" on public.shortlists;
create policy "employers manage own shortlists"
  on public.shortlists for all
  using (employer_id in (select public.employer_ids_for_user(auth.uid())))
  with check (employer_id in (select public.employer_ids_for_user(auth.uid())));

drop policy if exists "employers read own company views" on public.company_views;
create policy "employers read own company views"
  on public.company_views for select
  using (employer_id in (select public.employer_ids_for_user(auth.uid())));

-- messages: on top of the existing "sender or recipient" policy, let a team
-- member also read messages sent/received by any teammate on the same
-- company, so the inbox can be shared across the team rather than siloed
-- per person.
create policy "teammates can read each other's messages"
  on public.messages for select
  using (
    sender_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and status = 'active'
    )
    or recipient_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and status = 'active'
    )
  );
