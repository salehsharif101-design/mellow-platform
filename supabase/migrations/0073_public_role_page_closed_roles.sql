-- Lets the public role page (/jobs/:slug, RolePublic.jsx) show a closed
-- role instead of "Role not found", with a banner replacing the Apply
-- button. Two RLS gaps to close, for the same reason: both existing
-- policies only ever covered is_active = true.

-- 1. public.roles itself: "anyone can read active roles" (migration 0001)
-- only covers is_active = true. This new policy has no subquery on any
-- other table at all -- after the 0071/0072 incident (a roles policy that
-- subqueried applications, whose own policy subqueried roles back,
-- causing "infinite recursion detected in policy for relation roles"),
-- this is deliberately as simple as the original policy it complements,
-- with zero cross-table reference and therefore zero recursion surface.
create policy "anyone can read closed roles"
  on public.roles for select
  using (is_active = false);

-- 2. public.employer_profiles: covered for any authenticated visitor
-- already ("signed-in users can read employer profiles", auth.role() =
-- 'authenticated', migration 0001), but an anonymous visitor only gets in
-- via "anyone can read employer profiles with active roles" (migration
-- 0012), which is scoped to is_active = true and won't cover a closed
-- role's company details for a logged-out visitor.
--
-- Rather than add a second EXISTS-on-roles policy alongside 0012's (the
-- same subquery-on-roles shape that just caused the incident above, and
-- roles has its own "employers manage own roles" policy that subqueries
-- employer_profiles right back), this replaces 0012's policy outright
-- with a security definer function -- same technique migration 0072 just
-- introduced, and the one already established by migration 0065's
-- employer_ids_for_team_users. A security definer function's internal
-- query runs as the function's owner, which bypasses RLS on the tables it
-- touches (Postgres exempts a table's owner from its own RLS policies
-- unless FORCE ROW LEVEL SECURITY is set, which nothing in this schema
-- uses), so checking "does this employer have any role at all" through
-- the function never re-enters roles' own policies and can't cycle back.
--
-- employer_has_any_role checks for ANY role regardless of status, not
-- just active ones -- a strict superset of what the policy it replaces
-- covered, so this is a widening, not a behavior change, for every case
-- that already worked.
drop policy if exists "anyone can read employer profiles with active roles" on public.employer_profiles;

create or replace function public.employer_has_any_role(target_employer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.roles where roles.employer_id = target_employer_id
  )
$$;

revoke execute on function public.employer_has_any_role(uuid) from public;
grant execute on function public.employer_has_any_role(uuid) to anon, authenticated;

create policy "anyone can read employer profiles with any role"
  on public.employer_profiles for select
  using (public.employer_has_any_role(id));
