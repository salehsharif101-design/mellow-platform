-- Fixes "duplicate key value violates unique constraint
-- shortlists_employer_candidate_null_role_key" when an employer deletes a
-- role.
--
-- shortlists.role_id is `on delete set null` (migration 0042): deleting a
-- role turns every shortlist entry made for it into a general shortlist
-- (role_id null) rather than losing the shortlist. Migration 0063 later
-- added a unique index allowing only one general shortlist per
-- employer+candidate. So if a candidate was shortlisted for the role AND
-- already had a general shortlist entry (e.g. from the Talent Feed), the
-- set-null turns the role-scoped row into a second general row and the
-- whole role delete fails.
--
-- That role-scoped row would just duplicate the general one, so drop it
-- first. Shortlists with no existing general entry are untouched and still
-- fall back to general via the foreign key, exactly as before.
--
-- The "unshortlisted" activity log row that log_shortlist_activity (0068)
-- writes for each removed row carries this role's id, and
-- candidate_activity_log.role_id cascades on role delete, so it is removed
-- along with the role and never shows in a candidate's timeline.

create or replace function public.dedupe_shortlists_before_role_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.shortlists s
  where s.role_id = old.id
    and exists (
      select 1
      from public.shortlists g
      where g.employer_id = s.employer_id
        and g.candidate_id = s.candidate_id
        and g.role_id is null
    );
  return old;
end;
$$;

create trigger roles_dedupe_shortlists_before_delete
  before delete on public.roles
  for each row
  execute function public.dedupe_shortlists_before_role_delete();
