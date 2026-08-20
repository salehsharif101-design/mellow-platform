-- Lets a team member row be marked 'removed' as a fallback: the normal path
-- for removing a team member (api/team-remove.js) deletes their Supabase
-- Auth account entirely, which cascades away this row along with it (see
-- employer_team_members.user_id's "on delete cascade" in 0044). 'removed'
-- only persists when that auth deletion couldn't complete — Login.jsx checks
-- for it and blocks sign-in with a clear message instead of letting a
-- revoked team member back into the dashboard.

alter table public.employer_team_members drop constraint employer_team_members_status_check;
alter table public.employer_team_members
  add constraint employer_team_members_status_check check (status in ('invited', 'active', 'removed'));
