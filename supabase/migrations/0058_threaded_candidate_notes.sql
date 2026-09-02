-- Converts candidate_notes (migration 0057) from a single auto-saving note
-- per employer+candidate+role into an append-only threaded feed: every post
-- is its own row, nothing is ever edited or overwritten, and the whole team
-- can see every teammate's posts on the same candidate.

-- The old "one note per combination" constraint is exactly what has to go —
-- multiple posts per employer+candidate+role are now the point.
alter table public.candidate_notes
  drop constraint candidate_notes_employer_id_candidate_id_role_id_key;

-- Notes are never updated after posting, so the auto-saving update trigger
-- from 0057 no longer applies.
drop trigger if exists candidate_notes_set_updated_at on public.candidate_notes;
drop function if exists public.set_candidate_notes_updated_at();

-- author_id is kept for referential integrity; author_email is denormalized
-- at post time because RLS on public.users only ever lets a user read their
-- own row (see migration 0001) — without this, a teammate reading the
-- thread would have no way to resolve who posted someone else's note.
alter table public.candidate_notes
  add column author_id uuid references public.users (id),
  add column author_email text;

update public.candidate_notes cn
set author_id = cn.updated_by,
    author_email = coalesce(u.email, 'unknown')
from public.users u
where u.id = cn.updated_by;

update public.candidate_notes
set author_email = 'unknown'
where author_email is null;

alter table public.candidate_notes
  alter column author_email set not null,
  drop column updated_by,
  drop column updated_at;

create index on public.candidate_notes (employer_id, candidate_id, role_id, created_at desc);

-- log_note_activity (0057) handled both insert and update ("note_added" vs
-- "note_updated") — with editing gone, every post is an insert, so this
-- collapses to one branch. The author's email is folded into `detail`
-- itself (rather than left for the client to resolve via actor_user_id)
-- since the same RLS gap applies here: a teammate reading the activity log
-- can't join public.users to find out who actor_user_id is, but this
-- trigger runs as security definer so it can read new.author_email freely.
create or replace function public.log_note_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type, detail, actor_user_id)
  values (new.employer_id, new.candidate_id, new.role_id, 'note_added', new.author_email || ': ' || left(new.body, 120), new.author_id);
  return new;
end;
$$;

drop trigger if exists candidate_notes_log_activity on public.candidate_notes;
create trigger candidate_notes_log_activity
  after insert on public.candidate_notes
  for each row execute procedure public.log_note_activity();
