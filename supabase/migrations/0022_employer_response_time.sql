-- Average time (in hours) an employer takes to send their first reply after
-- receiving a message, shown on the public role page as "Usually responds
-- within X". messages RLS restricts reads to sender/recipient only, so this
-- can't be computed client-side on a public page — the function is
-- security definer to read across all of an employer's messages, but it
-- only ever returns a single aggregate number, never message content.
-- No historical cutoff: this platform's message history is small enough
-- that computing over all of it is effectively "starting now" in practice.
create or replace function public.employer_avg_response_hours(target_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select avg(extract(epoch from (reply.sent_at - incoming.sent_at)) / 3600.0)
  from public.messages incoming
  join lateral (
    select m.sent_at
    from public.messages m
    where m.sender_id = target_user_id
      and m.recipient_id = incoming.sender_id
      and m.sent_at > incoming.sent_at
    order by m.sent_at asc
    limit 1
  ) reply on true
  where incoming.recipient_id = target_user_id;
$$;

revoke execute on function public.employer_avg_response_hours(uuid) from public;
grant execute on function public.employer_avg_response_hours(uuid) to anon, authenticated;
