-- Messages must always display the sending company's identity, never the
-- individual team member's — but resolving "which employer_id does this
-- user id belong to" for someone who is NOT the caller (a candidate
-- looking up an employer team member they are messaging with, or an
-- employer looking up a teammate) has no RLS path today:
-- employer_team_members only lets the owner read their own team, or a
-- member read their own single row. A broad "any signed-in user can read
-- this table" policy (matching employer_profiles' own) is not safe here
-- the way it is there — invite_token and invited_email are genuinely
-- sensitive, and RLS can only restrict by row, not by column.
--
-- This function is the narrow alternative: security definer so it can see
-- every row regardless of the caller's own grants, but its return shape
-- only ever exposes the (user id, employer id) pairing needed for identity
-- resolution — active team members via user_id, removed ones via
-- removed_user_id (migration 0064).
create or replace function public.employer_ids_for_team_users(uids uuid[])
returns table(matched_user_id uuid, employer_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select user_id as matched_user_id, employer_id
  from public.employer_team_members
  where user_id = any(uids)
  union
  select removed_user_id as matched_user_id, employer_id
  from public.employer_team_members
  where removed_user_id = any(uids)
$$;

revoke execute on function public.employer_ids_for_team_users(uuid[]) from public;
grant execute on function public.employer_ids_for_team_users(uuid[]) to authenticated;
