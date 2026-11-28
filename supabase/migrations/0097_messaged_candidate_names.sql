-- The employer inbox labels each conversation with the candidate's name, but
-- employers can only read candidate_profiles rows that are live (0001), so a
-- candidate who is no longer live (removed their video, hired, never finished
-- onboarding) showed up as the generic "Talent".
--
-- Widening that read policy would expose the whole profile row of someone who
-- is off the market. This returns just the name instead, and only for
-- candidates who share a message with the caller's own company (owner, team
-- members and removed members, matching the shared inbox in 0064). A caller
-- with no company gets nothing back.
create or replace function public.messaged_candidate_names(uids uuid[])
returns table(candidate_user_id uuid, full_name text)
language sql
security definer
set search_path = public
stable
as $$
  with company_users as (
    select user_id as id from public.employer_profiles
      where id in (select public.employer_ids_for_user(auth.uid()))
    union
    select user_id from public.employer_team_members
      where employer_id in (select public.employer_ids_for_user(auth.uid())) and user_id is not null
    union
    select removed_user_id from public.employer_team_members
      where employer_id in (select public.employer_ids_for_user(auth.uid())) and removed_user_id is not null
  )
  select c.user_id, c.full_name
  from public.candidate_profiles c
  where c.user_id = any(uids)
    and exists (
      select 1 from public.messages m
      where (m.sender_id = c.user_id and m.recipient_id in (select id from company_users))
         or (m.recipient_id = c.user_id and m.sender_id in (select id from company_users))
    )
$$;

revoke execute on function public.messaged_candidate_names(uuid[]) from public, anon;
grant execute on function public.messaged_candidate_names(uuid[]) to authenticated;
