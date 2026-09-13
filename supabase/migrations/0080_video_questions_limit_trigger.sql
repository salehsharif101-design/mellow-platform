-- The 2-per-candidate-per-role limit was only ever enforced inside
-- ask_video_question (migration 0069) — a signed-in employer team member
-- calling supabase.from('video_questions').insert(...) directly bypasses
-- that RPC (and its advisory lock) entirely. The "employers manage own
-- video questions" RLS policy (migration 0066) only checks employer
-- membership, nothing about how many questions already exist for this
-- candidate+role. A trigger applies to every insert path — the RPC included
-- — unlike an RLS with-check subquery, which would still race the same way
-- the RPC's own comment describes without an equivalent lock.
create or replace function public.enforce_video_question_limit()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  -- Same lock key as ask_video_question (migration 0069) so a direct insert
  -- and an RPC-driven insert for the same candidate+role genuinely
  -- serialize against each other, not just against their own kind.
  perform pg_advisory_xact_lock(hashtextextended(new.candidate_id::text || ':' || new.role_id::text, 0));

  select count(*) into v_count
  from public.video_questions
  where candidate_id = new.candidate_id and role_id = new.role_id;

  if v_count >= 2 then
    raise exception 'question_limit_reached';
  end if;

  return new;
end;
$$;

create trigger video_questions_enforce_limit
  before insert on public.video_questions
  for each row
  execute function public.enforce_video_question_limit();
