-- Lets an employer add custom hiring-pipeline stages per role (e.g.
-- "Portfolio review", "Technical test", "Final interview", "Offer made"),
-- shown in the status dropdown on that role's applicant cards alongside the
-- four built-in stages (New/Reviewing/Shortlisted/Rejected).
--
-- The built-in stages are NOT rows in this table — they stay hardcoded in
-- the frontend (RoleApplicants.jsx) exactly as before, which is what makes
-- them structurally "always exist, cannot be deleted": there's nothing here
-- to delete. Custom stages always sit between Reviewing and Shortlisted in
-- the dropdown; `position` orders them relative to each other only.
--
-- A candidate sitting in a custom stage keeps applications.status =
-- 'reviewing' and additionally points custom_stage_id at the stage — status
-- itself never becomes a non-default value for a custom stage. That's what
-- keeps the dashboard's shortlisted/rejected counts (which filter on
-- applications.status = 'shortlisted' / 'rejected') correctly excluding
-- candidates parked in a custom stage, with no changes needed there.

create table public.role_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index on public.role_pipeline_stages (role_id);

alter table public.role_pipeline_stages enable row level security;

create policy "employers manage own role pipeline stages"
  on public.role_pipeline_stages for all
  using (role_id in (select id from public.roles where employer_id in (select public.employer_ids_for_user(auth.uid()))))
  with check (role_id in (select id from public.roles where employer_id in (select public.employer_ids_for_user(auth.uid()))));

-- Candidates reading a role's stages isn't needed anywhere today (the
-- public role page and candidate application flow don't surface pipeline
-- stages), so no candidate-facing select policy is added.

alter table public.applications
  add column custom_stage_id uuid references public.role_pipeline_stages (id) on delete set null;

create index on public.applications (custom_stage_id);
