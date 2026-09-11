-- api/video-question.js's 'ask-question' action used to enforce the
-- 2-per-candidate-per-role limit, and the "second question only after the
-- first is answered or expired" gating rule, with a plain
-- count-then-insert in application code. Neither check was atomic: two
-- near-simultaneous requests could both read the same count/status and
-- both proceed, landing 3 questions on one candidate, or a second question
-- while the first was still genuinely open. This function moves both
-- checks (plus the 300-character question-text cap, mirroring
-- QUESTION_TEXT_MAX_LENGTH in src/lib/videoQuestions.js) into the same
-- transaction as the insert, serialized with an advisory lock keyed on the
-- (candidate, role) pair so concurrent callers for that same pair can't
-- both pass the checks.
--
-- The 3-day answer window is hardcoded below (interval '3 days') rather
-- than read from anywhere — keep this in sync with ANSWER_WINDOW_DAYS in
-- src/lib/videoQuestions.js if that ever changes.
create or replace function public.ask_video_question(
  p_employer_id uuid,
  p_candidate_id uuid,
  p_role_id uuid,
  p_question_text text,
  p_asked_by uuid
)
returns public.video_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.video_questions;
  v_count int;
  v_result public.video_questions;
begin
  if char_length(p_question_text) > 300 then
    raise exception 'question_too_long';
  end if;

  -- Released automatically when this transaction (this one request's
  -- insert) commits or rolls back — a second request for the same
  -- candidate+role blocks here until the first has fully finished, instead
  -- of both reading the same pre-insert state.
  perform pg_advisory_xact_lock(hashtextextended(p_candidate_id::text || ':' || p_role_id::text, 0));

  select count(*) into v_count
  from public.video_questions
  where candidate_id = p_candidate_id and role_id = p_role_id;

  if v_count >= 2 then
    raise exception 'question_limit_reached';
  end if;

  if v_count = 1 then
    select * into v_existing
    from public.video_questions
    where candidate_id = p_candidate_id and role_id = p_role_id
    limit 1;

    if not (
      v_existing.status = 'answered'
      or v_existing.status = 'expired'
      or (v_existing.status = 'pending' and v_existing.asked_at < now() - interval '3 days')
    ) then
      raise exception 'first_question_open';
    end if;
  end if;

  insert into public.video_questions (employer_id, candidate_id, role_id, question_text, asked_by)
  values (p_employer_id, p_candidate_id, p_role_id, p_question_text, p_asked_by)
  returning * into v_result;

  return v_result;
end;
$$;

-- Only ever called from api/video-question.js's service-role client, which
-- already bypasses RLS on its own — security definer here is belt-and-
-- suspenders consistency with employer_ids_for_team_users (migration
-- 0065), not a requirement for this specific caller.
revoke execute on function public.ask_video_question(uuid, uuid, uuid, text, uuid) from public;
grant execute on function public.ask_video_question(uuid, uuid, uuid, text, uuid) to service_role;

-- Defense in depth, independent of the function above and of the client's
-- own textarea maxLength — nothing else in the codebase inserts into this
-- table, but this makes the 300-character cap a real database invariant
-- rather than something only application code happens to enforce.
alter table public.video_questions
  add constraint video_questions_question_text_length check (char_length(question_text) <= 300);
