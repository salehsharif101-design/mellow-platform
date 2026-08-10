-- Adds a 3-state status (open/paused/closed) that employers control from
-- Manage Roles. is_active stays as the single source of truth every existing
-- RLS policy and public-facing query already filters on, so nothing else
-- needs to change — a trigger keeps it in sync with status instead
-- ('open' -> true, 'paused'/'closed' -> false), giving both states the same
-- "hidden from candidates, visible to the owning employer" visibility the
-- feature calls for.
create type role_status as enum ('open', 'paused', 'closed');

alter table public.roles
  add column status role_status not null default 'open';

update public.roles set status = (case when is_active then 'open' else 'closed' end)::role_status;

create or replace function public.sync_role_is_active()
returns trigger
language plpgsql
as $$
begin
  new.is_active := (new.status = 'open');
  return new;
end;
$$;

create trigger sync_role_is_active_trigger
  before insert or update of status on public.roles
  for each row execute procedure public.sync_role_is_active();
