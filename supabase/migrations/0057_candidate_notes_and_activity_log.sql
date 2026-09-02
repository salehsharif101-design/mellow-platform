-- ── Candidate notes ──────────────────────────────────────────────────────
-- Private employer-side notes on an applicant, scoped per
-- employer+candidate+role so the same candidate applying to two different
-- roles at the same company gets independent notes for each. Never exposed
-- to the candidate (no candidate-facing policy at all). Team members get
-- the same read/write access as the account owner via employer_ids_for_user,
-- same as roles/applications/shortlists already do (see migration 0044).

create table public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  body text not null default '',
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (employer_id, candidate_id, role_id)
);

create index on public.candidate_notes (employer_id);
create index on public.candidate_notes (candidate_id);
create index on public.candidate_notes (role_id);

alter table public.candidate_notes enable row level security;

create policy "employers manage own candidate notes"
  on public.candidate_notes for all
  using (employer_id in (select public.employer_ids_for_user(auth.uid())))
  with check (employer_id in (select public.employer_ids_for_user(auth.uid())));

create or replace function public.set_candidate_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger candidate_notes_set_updated_at
  before update on public.candidate_notes
  for each row execute procedure public.set_candidate_notes_updated_at();

-- ── Candidate activity log ───────────────────────────────────────────────
-- Feeds the collapsible activity timeline on each applicant card. Populated
-- entirely by triggers (below), not application code, so every write path
-- to applications/candidate_notes/shortlists/messages — present and future —
-- produces a log entry automatically instead of relying on every call site
-- to remember to log it.
--
-- role_id is nullable: a message between an employer and a candidate isn't
-- tied to any specific role in this app's messaging model (see messages in
-- migration 0001), so message events are logged at the employer+candidate
-- level and simply included on every role's timeline for that candidate.
-- Same for a shortlist entry created with no role_id (general shortlist
-- from the Talent Feed, see migration 0042) — it's logged, just not
-- attached to a particular role's timeline.

create table public.candidate_activity_log (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  role_id uuid references public.roles (id) on delete cascade,
  event_type text not null check (
    event_type in ('applied', 'status_changed', 'shortlisted', 'unshortlisted', 'note_added', 'note_updated', 'message_sent')
  ),
  detail text,
  actor_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index on public.candidate_activity_log (employer_id, candidate_id, role_id);

alter table public.candidate_activity_log enable row level security;

-- Read-only from the client — every row is written by the trigger functions
-- below (security definer, so they bypass this same RLS to insert).
create policy "employers read own candidate activity log"
  on public.candidate_activity_log for select
  using (employer_id in (select public.employer_ids_for_user(auth.uid())));

-- applications: logs "applied" on insert, and "status_changed" whenever the
-- stage actually changes — either the status enum or, for a candidate
-- sitting in a custom stage, custom_stage_id (status alone would stay
-- 'reviewing' across a custom-stage move, so that alone can't be the only
-- trigger condition).
create or replace function public.log_application_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_id uuid;
  stage_label text;
begin
  select employer_id into emp_id from public.roles where id = new.role_id;
  if emp_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
    values (emp_id, new.candidate_id, new.role_id, 'applied');
    return new;
  end if;

  -- tg_op = 'UPDATE' beyond this point, so OLD is guaranteed assigned —
  -- deliberately checked as its own branch (rather than folded into one
  -- "tg_op = 'UPDATE' and new.x is distinct from old.x" condition above)
  -- so OLD is never referenced at all during an INSERT call.
  if new.status is distinct from old.status or new.custom_stage_id is distinct from old.custom_stage_id then
    stage_label := null;
    if new.custom_stage_id is not null then
      select name into stage_label from public.role_pipeline_stages where id = new.custom_stage_id;
    end if;
    if stage_label is null then
      stage_label := case new.status
        when 'applied' then 'New'
        when 'reviewing' then 'Reviewing'
        when 'shortlisted' then 'Shortlisted'
        when 'rejected' then 'Rejected'
        else initcap(new.status::text)
      end;
    end if;
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type, detail)
    values (emp_id, new.candidate_id, new.role_id, 'status_changed', stage_label);
  end if;

  return new;
end;
$$;

create trigger applications_log_activity
  after insert or update on public.applications
  for each row execute procedure public.log_application_activity();

-- candidate_notes: logs "note_added" once, then "note_updated" for every
-- later save that actually changes the body (the auto-save UI debounces
-- writes to one per pause in typing, so this stays proportionate rather
-- than firing per keystroke).
create or replace function public.log_note_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type, detail, actor_user_id)
    values (new.employer_id, new.candidate_id, new.role_id, 'note_added', left(new.body, 140), new.updated_by);
    return new;
  end if;

  -- tg_op = 'UPDATE' beyond this point, so OLD is guaranteed assigned.
  if new.body is distinct from old.body then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type, detail, actor_user_id)
    values (new.employer_id, new.candidate_id, new.role_id, 'note_updated', left(new.body, 140), new.updated_by);
  end if;
  return new;
end;
$$;

create trigger candidate_notes_log_activity
  after insert or update on public.candidate_notes
  for each row execute procedure public.log_note_activity();

-- shortlists: logs both directions of the employer's personal shortlist
-- (Talent Feed / applicant status dropdown / Shortlist page all write to
-- this same table).
create or replace function public.log_shortlist_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
    values (new.employer_id, new.candidate_id, new.role_id, 'shortlisted');
  elsif tg_op = 'DELETE' then
    insert into public.candidate_activity_log (employer_id, candidate_id, role_id, event_type)
    values (old.employer_id, old.candidate_id, old.role_id, 'unshortlisted');
  end if;
  return coalesce(new, old);
end;
$$;

create trigger shortlists_log_activity
  after insert or delete on public.shortlists
  for each row execute procedure public.log_shortlist_activity();

-- messages: resolves both directions — an employer-side user (owner or
-- active team member) messaging a candidate, or a candidate replying to an
-- employer-side user — since either can happen and both belong on the
-- candidate's activity timeline. A user who is team member on more than one
-- company produces one log row per company they could plausibly be acting
-- for; in practice that's always exactly one.
create or replace function public.log_message_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_id uuid;
  cand_id uuid;
begin
  select id into cand_id from public.candidate_profiles where user_id = new.recipient_id;
  if cand_id is not null then
    for emp_id in
      select id from public.employer_profiles where user_id = new.sender_id
      union
      select employer_id from public.employer_team_members where user_id = new.sender_id and status = 'active'
    loop
      insert into public.candidate_activity_log (employer_id, candidate_id, event_type, detail, actor_user_id)
      values (emp_id, cand_id, 'message_sent', left(new.body, 140), new.sender_id);
    end loop;
  end if;

  select id into cand_id from public.candidate_profiles where user_id = new.sender_id;
  if cand_id is not null then
    for emp_id in
      select id from public.employer_profiles where user_id = new.recipient_id
      union
      select employer_id from public.employer_team_members where user_id = new.recipient_id and status = 'active'
    loop
      insert into public.candidate_activity_log (employer_id, candidate_id, event_type, detail, actor_user_id)
      values (emp_id, cand_id, 'message_sent', left(new.body, 140), new.sender_id);
    end loop;
  end if;

  return new;
end;
$$;

create trigger messages_log_activity
  after insert on public.messages
  for each row execute procedure public.log_message_activity();
