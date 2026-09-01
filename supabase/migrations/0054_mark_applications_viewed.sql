-- The employer dashboard's "What's new" feed uses
-- employer_profiles.last_viewed_applications_at as its "since last visit"
-- marker, updated by NotificationContext's clearApplicationsBadge(). But
-- the only UPDATE policy on employer_profiles ("employers manage own
-- profile", migration 0001) is owner-only — so for a team member, that
-- update was silently blocked by RLS (0 rows affected, no error), and the
-- marker never advanced past whatever the owner last set it to.
--
-- A security-definer function, rather than widening the UPDATE policy
-- itself, so team members don't gain the ability to edit the company
-- profile's other columns (name, logo, culture, etc.) — EditProfile.jsx
-- already deliberately restricts those edits to the owner only, and a
-- broader RLS policy would silently bypass that from the API even though
-- the UI still enforces it.
create or replace function public.mark_applications_viewed(target_employer_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.employer_profiles
  set last_viewed_applications_at = now()
  where id = target_employer_id
    and target_employer_id in (select public.employer_ids_for_user(auth.uid()));
$$;

revoke execute on function public.mark_applications_viewed(uuid) from public;
grant execute on function public.mark_applications_viewed(uuid) to authenticated;
