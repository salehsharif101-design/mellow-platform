-- Migration 0044 widened the messages SELECT policy so a team member can
-- read messages addressed to any teammate on the same company (the shared
-- inbox), but never widened UPDATE alongside it — the original recipient-
-- only policy from 0001 is still the only way to mark a message read. A
-- message addressed to a teammate's own user_id can therefore never be
-- marked read by anyone else, so the bulk "mark read" update in
-- MessageThread.jsx silently affects zero rows for it, and the shared
-- unread badge stays lit for the whole team even after someone reads it.
--
-- This mirrors the recipient-side half of 0044's "teammates can read each
-- other's messages" policy, scoped to UPDATE and to messages the caller's
-- team is actually the recipient of (marking read is a recipient action —
-- there's no reason a teammate needs to update a message their team sent).

create policy "teammates can mark team messages read"
  on public.messages for update
  using (
    recipient_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and status = 'active'
    )
  )
  with check (
    recipient_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and status = 'active'
    )
  );
