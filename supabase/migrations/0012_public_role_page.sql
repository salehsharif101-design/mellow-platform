-- Lets anonymous visitors read the employer_profiles row backing any active
-- role, needed for the public shareable role page (/jobs/:roleId) to show
-- company name/logo without requiring login.
create policy "anyone can read employer profiles with active roles"
  on public.employer_profiles for select
  using (
    exists (
      select 1 from public.roles
      where roles.employer_id = employer_profiles.id
      and roles.is_active = true
    )
  );

-- Hygiene: handle_new_user() and generate_candidate_username() are trigger
-- functions (return type "trigger"), so Postgres already refuses to execute
-- them outside of actual trigger context regardless of grants — but revoke
-- the default PUBLIC execute grant anyway for defense in depth.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.generate_candidate_username() from public;
