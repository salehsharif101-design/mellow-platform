-- Clean, shareable company profile URLs: /company/[slug]. Mirrors migration
-- 0005's candidate username pattern: generated once from company_name and
-- never overwritten, so the public URL stays stable even if the employer
-- edits their company name later.
alter table public.employer_profiles
  add column company_slug text unique;

create or replace function public.generate_company_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_slug text;
  final_slug text;
  suffix int := 1;
begin
  if new.company_slug is not null then
    return new;
  end if;
  if new.company_name is null or trim(new.company_name) = '' then
    return new;
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(unaccent(new.company_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'company';
  end if;

  final_slug := base_slug;
  while exists (
    select 1 from public.employer_profiles
    where company_slug = final_slug and id is distinct from new.id
  ) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  new.company_slug := final_slug;
  return new;
end;
$$;

create trigger set_company_slug
  before insert or update of company_name on public.employer_profiles
  for each row execute procedure public.generate_company_slug();

-- Backfill existing employers that already have a company name but no slug.
do $$
declare
  r record;
  base_slug text;
  final_slug text;
  suffix int;
begin
  for r in
    select id, company_name from public.employer_profiles
    where company_slug is null and company_name is not null and trim(company_name) <> ''
    order by created_at asc
  loop
    base_slug := trim(both '-' from regexp_replace(lower(unaccent(r.company_name)), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then
      base_slug := 'company';
    end if;

    final_slug := base_slug;
    suffix := 1;
    while exists (select 1 from public.employer_profiles where company_slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    end loop;

    update public.employer_profiles set company_slug = final_slug where id = r.id;
  end loop;
end $$;

create index on public.employer_profiles (company_slug);
