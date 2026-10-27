-- Records when a candidate's profile first went live, so the follow-up emails
-- (work videos at 24 hours, profile link at 48 hours) can be timed from that
-- moment instead of from signup. Also tracks the work-videos email so it is
-- only ever sent once.
--
-- A trigger sets went_live_at the first time is_live becomes true, however
-- that happens (finishing onboarding, uploading an intro video from Edit
-- Profile), so no app code needs to remember to. It is set once and never
-- moved. Candidates who are already live are NOT backfilled: their real
-- go-live moment isn't known, and a guessed timestamp would make the hourly
-- job treat them as brand new. They are covered by the one-time
-- re-engagement send instead.
--
-- Adds columns to an existing table, so no new grants are needed.

alter table public.candidate_profiles
  add column if not exists went_live_at timestamptz,
  add column if not exists video_library_email_sent_at timestamptz;

create or replace function public.set_candidate_went_live_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_live is true
     and new.went_live_at is null
     and (tg_op = 'INSERT' or old.is_live is distinct from true) then
    new.went_live_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists candidate_profiles_set_went_live_at on public.candidate_profiles;
create trigger candidate_profiles_set_went_live_at
  before insert or update on public.candidate_profiles
  for each row
  execute function public.set_candidate_went_live_at();
