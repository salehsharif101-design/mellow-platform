-- 0071's "candidates can read roles they applied to" policy on public.roles
-- subqueries public.applications. public.applications already has its own
-- policy ("employers read applications to their roles", migration 0001)
-- that subqueries public.roles. Postgres re-applies each table's RLS
-- policies to every nested query a policy's own USING clause makes, so
-- those two policies formed a genuine cycle: evaluating roles -> queries
-- applications -> (applications' own policy) queries roles -> queries
-- applications -> ... forever, surfacing as "infinite recursion detected
-- in policy for relation roles" and failing the candidate Applications
-- page's query outright (not just the nested company-details embed --
-- the whole request errored, which is why every application disappeared
-- from the page, not just the company name/logo).
--
-- Fixed the same way migration 0065's employer_ids_for_team_users breaks
-- an equivalent cycle: a security definer function's internal query runs
-- as the function's owner, which bypasses RLS on the tables it touches
-- (Postgres exempts a table's owner from its own RLS policies unless FORCE
-- ROW LEVEL SECURITY is set, which nothing in this schema uses) --
-- so checking "has this candidate applied to this role" through the
-- function never re-enters applications' own policies, and the cycle
-- can't start.
drop policy if exists "candidates can read roles they applied to" on public.roles;

create or replace function public.candidate_has_applied_to_role(target_role_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.applications a
    join public.candidate_profiles cp on cp.id = a.candidate_id
    where a.role_id = target_role_id and cp.user_id = auth.uid()
  )
$$;

revoke execute on function public.candidate_has_applied_to_role(uuid) from public;
grant execute on function public.candidate_has_applied_to_role(uuid) to authenticated;

create policy "candidates can read roles they applied to"
  on public.roles for select
  using (public.candidate_has_applied_to_role(id));
