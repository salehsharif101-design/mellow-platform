-- Clean, shareable candidate profile URLs: /profile/[username] instead of
-- /profile/[uuid]. The uuid (candidate_profiles.id) stays the internal PK;
-- username is a separate, public-facing slug.

create extension if not exists unaccent;

alter table public.candidate_profiles
  add column username text unique;

-- Generates a slug from full_name once, on first save, and never overwrites
-- an existing username — so a profile's public URL stays stable even if the
-- candidate edits their name later.
create or replace function public.generate_candidate_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  final_slug text;
  suffix int := 1;
begin
  if new.username is not null then
    return new;
  end if;
  if new.full_name is null or trim(new.full_name) = '' then
    return new;
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(unaccent(new.full_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'candidate';
  end if;

  final_slug := base_slug;
  while exists (
    select 1 from public.candidate_profiles
    where username = final_slug and id is distinct from new.id
  ) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  new.username := final_slug;
  return new;
end;
$$;

create trigger set_candidate_username
  before insert or update of full_name on public.candidate_profiles
  for each row execute procedure public.generate_candidate_username();

-- Backfill existing profiles that already have a name but no username yet.
-- Runs the same slugging logic; processes oldest-first so earlier signups
-- keep the unsuffixed slug.
do $$
declare
  r record;
  base_slug text;
  final_slug text;
  suffix int;
begin
  for r in
    select id, full_name from public.candidate_profiles
    where username is null and full_name is not null and trim(full_name) <> ''
    order by created_at asc
  loop
    base_slug := trim(both '-' from regexp_replace(lower(unaccent(r.full_name)), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then
      base_slug := 'candidate';
    end if;

    final_slug := base_slug;
    suffix := 1;
    while exists (select 1 from public.candidate_profiles where username = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    end loop;

    update public.candidate_profiles set username = final_slug where id = r.id;
  end loop;
end $$;

-- Public profile lookups now happen by username instead of id.
create index on public.candidate_profiles (username);
