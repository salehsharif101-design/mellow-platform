-- Associates shortlist entries with the role they were shortlisted for, so
-- an employer's shortlist can be grouped and reviewed one role at a time
-- instead of all roles mixed together. Nullable: a candidate can still be
-- shortlisted generally from the Talent Feed with no role context.

alter table public.shortlists
  add column role_id uuid references public.roles (id) on delete set null;

create index on public.shortlists (role_id);

-- A candidate can now be shortlisted once per role, plus once more with no
-- role at all — replaces the old "once per employer+candidate, ever" rule.
alter table public.shortlists drop constraint shortlists_employer_id_candidate_id_key;
alter table public.shortlists
  add constraint shortlists_employer_candidate_role_key unique (employer_id, candidate_id, role_id);
