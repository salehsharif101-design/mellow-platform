-- The candidate dashboard now shows "Shortlisted by employers" (with an
-- unread badge), but shortlists RLS only ever granted the owning employer
-- read access — candidates had no way to see their own shortlist rows.
create policy "candidates can read own shortlist entries"
  on public.shortlists for select
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));
