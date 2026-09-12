-- Notifying the rest of the team when someone pauses/closes a role needs
-- to know who did it. RLS on public.users only ever lets a user read their
-- own row ("users can read own row", migration 0001), so a teammate has no
-- way to resolve a fellow teammate's email from status_changed_by alone --
-- same problem migration 0058 solved for candidate_notes by denormalizing
-- the author's email onto the row at write time instead of joining users
-- at read time. Same fix here.
alter table public.roles
  add column status_changed_by uuid references public.users (id),
  add column status_changed_by_email text;

-- Replaces migration 0074's function body (same trigger, already firing
-- on every status update, just does more now) rather than adding a second
-- trigger for the same event.
create or replace function public.set_role_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
    new.status_changed_by = auth.uid();
    -- Not security definer and doesn't need to be: this only ever looks up
    -- the ACTING user's own row (auth.uid() is literally who's running
    -- this statement), which "users can read own row" already permits
    -- without any elevated privilege.
    select u.email into new.status_changed_by_email from public.users u where u.id = auth.uid();
  end if;
  return new;
end;
$$;
