-- hires (added in migration 0049, after roles/applications/shortlists/
-- company_views were widened for team members in 0044) was left
-- owner-only for SELECT — an active team member reading it gets an empty
-- result rather than an error, which would silently hide the "candidate
-- accepted a meeting booking" employer dashboard feed item for anyone but
-- the owner.
drop policy if exists "employers read own hires" on public.hires;
create policy "employers read own hires"
  on public.hires for select
  using (employer_id in (select public.employer_ids_for_user(auth.uid())));
