-- Supports the talent-side dashboard features:
--   1/2. Activity feed + progress tracker reuse existing timestamp columns
--        (candidate_profiles.last_viewed_dashboard_at, profile_views,
--        shortlists, messages) — no new columns needed for those.
--   4. Application timeline needs to know *when* an application's status
--      last changed (applied_at and viewed_at already exist).
--   7. Saved roles is a new table.
--   6/9. The combined weekly digest cron needs a per-side dedup marker so a
--        double cron-fire in the same week doesn't double-send.

-- ── Application status timeline ─────────────────────────────────────────

alter table public.applications
  add column status_changed_at timestamptz;

create or replace function public.set_application_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger applications_set_status_changed_at
  before update on public.applications
  for each row execute procedure public.set_application_status_changed_at();

-- ── Saved roles ──────────────────────────────────────────────────────────
-- role_id is nullable (set null, not cascade) and title/company are
-- snapshotted at save time so a saved role still displays sensibly — with
-- an "expired" note — even after the employer hard-deletes it, not just
-- when they close it (is_active = false, where the row is untouched).

create table public.saved_roles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  role_id uuid references public.roles (id) on delete set null,
  role_title text not null,
  company_name text,
  created_at timestamptz not null default now(),
  unique (candidate_id, role_id)
);

create index on public.saved_roles (candidate_id);
create index on public.saved_roles (role_id);

alter table public.saved_roles enable row level security;

create policy "candidates manage own saved roles"
  on public.saved_roles for all
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()))
  with check (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));

-- The existing "anyone can read active roles" policy on public.roles won't
-- cover a role the candidate saved that the employer has since closed
-- (is_active = false, row still exists) — this adds that visibility back
-- for saved roles specifically, so the Saved tab can still show it.
create policy "candidates can read roles they saved"
  on public.roles for select
  using (
    id in (
      select sr.role_id from public.saved_roles sr
      join public.candidate_profiles cp on cp.id = sr.candidate_id
      where cp.user_id = auth.uid()
    )
  );

-- ── Weekly digest dedup ──────────────────────────────────────────────────

alter table public.candidate_profiles
  add column last_weekly_digest_sent_at timestamptz;

alter table public.employer_profiles
  add column last_weekly_digest_sent_at timestamptz;
