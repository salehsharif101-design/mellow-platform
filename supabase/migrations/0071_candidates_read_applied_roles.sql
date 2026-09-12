-- The candidate Applications page joins applications -> roles ->
-- employer_profiles to show the company name/logo for each application
-- (src/pages/candidate/Applications.jsx). employer_profiles is readable by
-- any signed-in user regardless of role status, but public.roles only has
-- "anyone can read active roles" (is_active = true) -- once an employer
-- closes a role, RLS silently blocks that row for the candidate who
-- applied to it, and PostgREST's nested embed then has no roles row to
-- attach employer_profiles to either, even though employer_profiles itself
-- would have been readable. That's what shows up as a blank company name
-- and a missing logo on the candidate's own Applications page for a role
-- that's since closed -- not a broken join, a row RLS is hiding.
--
-- Exact same problem as saved_roles (migration 0037's "candidates can read
-- roles they saved"), just for applications instead: a candidate should
-- always be able to see the company details for something they applied to
-- or saved, whether or not the employer has since closed it. A truly
-- deleted role cascades and deletes the application row with it
-- (applications.role_id is `on delete cascade`), so there's no orphaned
-- "application without a role" case to handle here -- only closed
-- (is_active = false, row still exists) needs this.
create policy "candidates can read roles they applied to"
  on public.roles for select
  using (
    id in (
      select a.role_id from public.applications a
      join public.candidate_profiles cp on cp.id = a.candidate_id
      where cp.user_id = auth.uid()
    )
  );
