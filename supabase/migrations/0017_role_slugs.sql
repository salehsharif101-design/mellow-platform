-- Clean, shareable role URLs: /jobs/[slug] instead of /jobs/[uuid].
-- Mirrors migration 0005's candidate username pattern, except the slug is
-- built from company_name (on employer_profiles) + title (on roles), so the
-- trigger needs a lookup join. No security definer needed here: employer_profiles
-- is publicly readable (migration 0013), so the invoking employer's own
-- privileges are already sufficient.

alter table public.roles
  add column slug text unique;

create or replace function public.generate_role_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  company text;
  base_slug text;
  final_slug text;
  suffix int := 1;
begin
  if new.slug is not null then
    return new;
  end if;

  select company_name into company from public.employer_profiles where id = new.employer_id;
  if company is null or trim(company) = '' then
    company := 'company';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(unaccent(company || ' ' || new.title)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'role';
  end if;

  final_slug := base_slug;
  while exists (
    select 1 from public.roles
    where slug = final_slug and id is distinct from new.id
  ) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  new.slug := final_slug;
  return new;
end;
$$;

create trigger set_role_slug
  before insert on public.roles
  for each row execute procedure public.generate_role_slug();

-- Backfill any pre-existing roles (defensive — the table is empty as of this
-- migration, but this matches the same safety pattern as migration 0005).
do $$
declare
  r record;
  company text;
  base_slug text;
  final_slug text;
  suffix int;
begin
  for r in
    select id, employer_id, title from public.roles where slug is null order by created_at asc
  loop
    select company_name into company from public.employer_profiles where id = r.employer_id;
    if company is null or trim(company) = '' then
      company := 'company';
    end if;

    base_slug := trim(both '-' from regexp_replace(lower(unaccent(company || ' ' || r.title)), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then
      base_slug := 'role';
    end if;

    final_slug := base_slug;
    suffix := 1;
    while exists (select 1 from public.roles where slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    end loop;

    update public.roles set slug = final_slug where id = r.id;
  end loop;
end $$;

alter table public.roles alter column slug set not null;

create index on public.roles (slug);
