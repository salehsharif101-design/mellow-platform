-- Replaces employer_avg_response_hours (0022) with a version that also
-- returns how many qualifying responses it's averaged over, so callers can
-- gate display on "at least 3 responses" instead of showing a rate computed
-- from a single lucky/unlucky reply. Also scopes to messages actually sent
-- by a candidate, matching the feature's intent literally rather than
-- relying on the product having no other message flow.
drop function if exists public.employer_avg_response_hours(uuid);

create or replace function public.employer_avg_response_hours(target_user_id uuid)
returns table(avg_hours numeric, response_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    avg(extract(epoch from (reply.sent_at - incoming.sent_at)) / 3600.0) as avg_hours,
    count(*) as response_count
  from public.messages incoming
  join public.users sender on sender.id = incoming.sender_id
  join lateral (
    select m.sent_at
    from public.messages m
    where m.sender_id = target_user_id
      and m.recipient_id = incoming.sender_id
      and m.sent_at > incoming.sent_at
    order by m.sent_at asc
    limit 1
  ) reply on true
  where incoming.recipient_id = target_user_id
    and sender.user_type = 'candidate';
$$;

revoke execute on function public.employer_avg_response_hours(uuid) from public;
grant execute on function public.employer_avg_response_hours(uuid) to anon, authenticated;
