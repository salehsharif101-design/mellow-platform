-- Async video interviewing: an employer (owner or any team member) sends a
-- candidate a written question tied to one of their applications; the
-- candidate records or uploads a video answer from a public link, no
-- account required. answer_token is the only credential that link carries —
-- unique and unguessable (a random uuid, same idea as
-- employer_team_members.invite_token) — since the answer page and its
-- upload flow run entirely through api/video-question.js using the service
-- role client, never through a client-side Supabase query a candidate's own
-- (possibly nonexistent) session could satisfy.
create table public.video_questions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  question_text text not null,
  asked_by uuid not null references public.users (id),
  asked_at timestamptz not null default now(),
  answer_video_url text,
  answered_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'answered', 'expired')),
  reminder_sent boolean not null default false,
  answer_token uuid not null default gen_random_uuid() unique
);

create index on public.video_questions (employer_id);
create index on public.video_questions (candidate_id);
create index on public.video_questions (role_id);
create index on public.video_questions (answer_token);

alter table public.video_questions enable row level security;

-- The 2-per-candidate-per-role limit applies across the whole team, not
-- per person, so any active team member (not just whoever asked a given
-- question) can read, ask, and see answers for their company's questions.
create policy "employers manage own video questions"
  on public.video_questions for all
  using (employer_id in (select public.employer_ids_for_user(auth.uid())))
  with check (employer_id in (select public.employer_ids_for_user(auth.uid())));

-- Read-only for the candidate this question is about (dashboard feed item,
-- and so the applicant-facing side of the app could show it if needed).
-- Candidates never write this table directly — an answer submission goes
-- through api/video-question.js's service-role client instead, since the
-- whole point of the public /answer-question/:token page is working for a
-- logged-out candidate too.
create policy "candidates read own video questions"
  on public.video_questions for select
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));
