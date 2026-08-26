-- Backs the post-meeting follow-up loop: api/calendly-webhook.js records a
-- meetings row when a candidate's Calendly account reports a booking,
-- api/cron/meeting-follow-up.js emails the employer 24h after
-- scheduled_at and nudges the candidate 7 days after either side signals
-- the hire isn't confirmed, and api/meeting-outcome.js (hit by the
-- hire-confirmed / still-deciding / hire-accepted / hire-declined pages)
-- records the outcome.
--
-- calendly_event_uri is unique so a retried webhook delivery for the same
-- Calendly event upserts instead of creating a duplicate meeting.
-- hire_confirmed_by_employer_at guards against re-sending the
-- candidate's hire-confirmation email if that link is opened more than
-- once. outcome_recorded_at is the baseline the 7-day talent-nudge cron
-- measures from — stamped once, the first time the employer says "still
-- deciding" or the candidate says "not yet" on the same meeting.

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  scheduled_at timestamptz not null,
  booking_created_at timestamptz not null default now(),
  calendly_event_uri text not null unique,
  follow_up_sent boolean not null default false,
  hire_confirmed_by_employer_at timestamptz,
  outcome_recorded_at timestamptz,
  talent_nudge_sent boolean not null default false
);

create index on public.meetings (employer_id);
create index on public.meetings (candidate_id);

alter table public.meetings enable row level security;

create policy "employers read own meetings"
  on public.meetings for select
  using (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));

create policy "candidates read own meetings"
  on public.meetings for select
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));

-- unique(employer_id, candidate_id): a pair can only ever be recorded as a
-- confirmed hire once, matching api/meeting-outcome.js's idempotency check
-- on the "hire_accepted" action.
create table public.hires (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade,
  role_id uuid references public.roles (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create index on public.hires (employer_id);
create index on public.hires (candidate_id);

alter table public.hires enable row level security;

create policy "employers read own hires"
  on public.hires for select
  using (employer_id in (select id from public.employer_profiles where user_id = auth.uid()));

create policy "candidates read own hires"
  on public.hires for select
  using (candidate_id in (select id from public.candidate_profiles where user_id = auth.uid()));
