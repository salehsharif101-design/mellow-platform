-- Candidate dashboard "What's new" feed needs to know WHEN a role's status
-- last changed to tell a recent pause/close (worth a feed item) apart from
-- one that happened long ago. roles had no such timestamp -- mirrors
-- applications.status_changed_at exactly (migration 0037's
-- set_application_status_changed_at / applications_set_status_changed_at).
alter table public.roles
  add column status_changed_at timestamptz;

create or replace function public.set_role_status_changed_at()
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

create trigger roles_set_status_changed_at
  before update on public.roles
  for each row execute procedure public.set_role_status_changed_at();
