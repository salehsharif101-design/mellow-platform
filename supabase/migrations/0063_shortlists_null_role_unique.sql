-- migration 0042 added a unique constraint on (employer_id, candidate_id,
-- role_id) so a candidate can't be shortlisted twice for the same role —
-- but Postgres treats every NULL as distinct from every other NULL in a
-- unique constraint, so it never actually stopped a duplicate GENERAL
-- shortlist (role_id is null): a stale client cache, a second tab, or a
-- retried request can all produce a second row for the exact same
-- employer+candidate pair with no role attached, inflating "times
-- shortlisted" counts and firing a second shortlist-notification email.
--
-- A partial unique index closes exactly that gap without touching the
-- existing constraint's behavior for role-scoped shortlists at all.

create unique index shortlists_employer_candidate_null_role_key
  on public.shortlists (employer_id, candidate_id)
  where role_id is null;
