-- Fixes a foreign-key violation when deleting a candidate_profiles or
-- employer_profiles row that has ever been shortlisted.
--
-- log_shortlist_activity (migration 0057) runs AFTER DELETE on shortlists
-- and logs an "unshortlisted" event by inserting into
-- candidate_activity_log using old.employer_id/old.candidate_id. That's
-- correct for a genuine un-shortlist action, but shortlists.employer_id
-- and .candidate_id both cascade-delete from employer_profiles/
-- candidate_profiles (migration 0001) — so deleting either profile also
-- cascade-deletes any shortlists row for it, firing this same trigger.
-- At that point the profile row is already gone from this transaction's
-- own view (Postgres's own uncommitted deletes are visible to itself), so
-- the INSERT's FK check against employer_profiles/candidate_profiles
-- fails with "insert or update on table candidate_activity_log violates
-- foreign key constraint ..._fkey" — even though no candidate_activity_log
-- rows existed beforehand. This blocks account deletion (api/delete-
-- account.js) for any user who was ever shortlisted.
--
-- Fix: only log "unshortlisted" when both referenced profiles still
-- exist. A genuine un-shortlist (both profiles still present) logs
-- exactly as before; a cascade delete from profile deletion skips the
-- insert — the activity log row would just get cascade-deleted again
-- anyway once the profile is gone, so there's nothing worth logging.

create or replace function public.log_shortlist_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
    values (new.employer_id, new.candidate_id, new.role_id, 'shortlisted');
  elsif tg_op = 'DELETE' then
    if exists (select 1 from public.employer_profiles where id = old.employer_id)
       and exists (select 1 from public.candidate_profiles where id = old.candidate_id) then
      insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
      values (old.employer_id, old.candidate_id, old.role_id, 'unshortlisted');
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
