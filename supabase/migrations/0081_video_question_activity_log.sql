-- Video question events (asked/answered/expired) never produced a
-- candidate_activity_log row, unlike every other applicant action (notes,
-- messages, status/stage changes, shortlisting) — migration 0057 populates
-- that table entirely via triggers, so this was a gap in trigger coverage,
-- not something application code needs to additionally call. Widens the
-- event_type check constraint and adds the matching trigger on
-- video_questions, following the exact same pattern as
-- log_application_activity/log_shortlist_activity/log_message_activity.
alter table public.candidate_activity_log
  drop constraint candidate_activity_log_event_type_check;

alter table public.candidate_activity_log
  add constraint candidate_activity_log_event_type_check
  check (event_type in (
    'applied', 'status_changed', 'shortlisted', 'unshortlisted', 'note_added', 'note_updated', 'message_sent',
    'question_asked', 'question_answered', 'question_expired'
  ));

create or replace function public.log_video_question_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type, actor_user_id)
    values (new.employer_id, new.candidate_id, new.role_id, 'question_asked', new.asked_by);
    return new;
  end if;

  -- tg_op = 'UPDATE' beyond this point, so OLD is guaranteed assigned.
  if new.status is distinct from old.status then
    if new.status = 'answered' then
      insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
      values (new.employer_id, new.candidate_id, new.role_id, 'question_answered');
    elsif new.status = 'expired' then
      insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
      values (new.employer_id, new.candidate_id, new.role_id, 'question_expired');
    end if;
  end if;

  return new;
end;
$$;

create trigger video_questions_log_activity
  after insert or update on public.video_questions
  for each row execute procedure public.log_video_question_activity();
