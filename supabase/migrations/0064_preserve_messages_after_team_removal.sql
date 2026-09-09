-- Removing a team member (api/team-remove.js) deletes their Supabase Auth
-- account entirely so the email can be reused for a fresh signup. That
-- deletion cascades: auth.users -> public.users (its own "on delete
-- cascade") -> messages.sender_id/recipient_id (also "on delete cascade",
-- from 0001) -- which permanently destroyed every message that removed
-- member ever sent or received, for the candidate on the other end too,
-- not just the employer's shared inbox. Messages are business records
-- that belong to the company, not the individual who happened to type
-- them, so that cascade needs to stop at messages. Dropped entirely rather
-- than switched to "on delete set null": a nulled sender_id/recipient_id
-- would lose the very id the policies below (and removed_user_id) need to
-- keep matching against, and there is nothing else sensible to point it
-- at once the account is gone.
alter table public.messages drop constraint messages_sender_id_fkey;
alter table public.messages drop constraint messages_recipient_id_fkey;

-- The policies below need "which user ids were ever part of this team,"
-- not just the currently-active ones -- but employer_team_members.user_id
-- gets set to null the moment a removed member's auth account is actually
-- deleted (0046's tombstone), which would otherwise erase the one thing
-- still linking their old messages back to this company. removed_user_id
-- is a permanent copy of that id, written once at removal time
-- (api/team-remove.js), with no foreign key of its own since it must
-- survive its target's deletion just like the tombstone row itself does.
alter table public.employer_team_members add column removed_user_id uuid;

-- Both messages policies below originally required status = 'active' on
-- the inner employer_team_members lookup, which is right for "can this
-- caller currently act as this company" (still enforced by the outer
-- employer_ids_for_user(auth.uid()) check, unchanged) but wrong for "whose
-- past messages count as this company's" -- once a member's status flips
-- to 'removed', their sent/received messages silently stopped matching
-- either policy and vanished from the shared inbox for everyone, even
-- though the row itself (now) survives. user_id is not null already
-- excludes 'invited' rows (whose user_id is null until accepted), so
-- dropping the status check and adding removed_user_id here is what makes
-- an active OR removed member's messages equally visible.

drop policy "teammates can read each other's messages" on public.messages;
create policy "teammates can read each other's messages"
  on public.messages for select
  using (
    sender_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and user_id is not null
      union
      select removed_user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and removed_user_id is not null
    )
    or recipient_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and user_id is not null
      union
      select removed_user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and removed_user_id is not null
    )
  );

drop policy "teammates can mark team messages read" on public.messages;
create policy "teammates can mark team messages read"
  on public.messages for update
  using (
    recipient_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and user_id is not null
      union
      select removed_user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and removed_user_id is not null
    )
  )
  with check (
    recipient_id in (
      select user_id from public.employer_profiles where id in (select public.employer_ids_for_user(auth.uid()))
      union
      select user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and user_id is not null
      union
      select removed_user_id from public.employer_team_members where employer_id in (select public.employer_ids_for_user(auth.uid())) and removed_user_id is not null
    )
  );
