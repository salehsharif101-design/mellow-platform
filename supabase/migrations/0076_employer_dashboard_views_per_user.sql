-- employer_profiles.last_viewed_applications_at (migration 0030) is a single
-- column on the shared company row, so it tracked one "since last visit"
-- cursor for the whole team rather than one per person. In practice: a team
-- member pauses/closes a role, then visits their own dashboard (which
-- correctly excludes their own action from the feed) — but that visit also
-- advances the one shared cursor past the pause/close event, so the other
-- team member's dashboard never shows the notification at all, because by
-- the time they load it the cursor is already past it.
--
-- This table gives every user their own cursor per employer account, so
-- visiting your own dashboard only marks things "seen" for you.
create table public.employer_dashboard_views (
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  last_viewed_applications_at timestamptz not null,
  primary key (employer_id, user_id)
);

create index on public.employer_dashboard_views (user_id);

alter table public.employer_dashboard_views enable row level security;

-- Unlike employer_profiles (owner-only writes, see migration 0054's
-- mark_applications_viewed workaround), every row here belongs to exactly
-- the one user it's keyed by, so that user can read/write it directly — no
-- security-definer function needed. employer_ids_for_user still gates which
-- employer_id a row may be created under, so a user can't plant a cursor row
-- for a company they don't belong to.
create policy "users manage own dashboard view state"
  on public.employer_dashboard_views for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and employer_id in (select public.employer_ids_for_user(auth.uid())));

-- No longer needed now that employer_dashboard_views lets a team member
-- write their own cursor directly.
drop function if exists public.mark_applications_viewed(uuid);

alter table public.employer_profiles drop column last_viewed_applications_at;
