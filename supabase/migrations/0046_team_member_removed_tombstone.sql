-- A removed team member's row needs to survive their Supabase Auth account
-- being deleted, so the login page can always recognize "this email was
-- removed" and show a clear message - even after the account itself is
-- long gone. Previously user_id cascaded away the whole row when the
-- referenced users row was deleted, which erased the only record that the
-- removal ever happened. Switching to "on delete set null" keeps the row
-- (with status still 'removed' and user_id now null) as a permanent
-- tombstone; api/check-removed-member.js and Login.jsx key off it by email
-- rather than user_id for exactly this reason.

alter table public.employer_team_members drop constraint employer_team_members_user_id_fkey;
alter table public.employer_team_members
  add constraint employer_team_members_user_id_fkey foreign key (user_id) references public.users (id) on delete set null;
