-- Re-introduces Calendly OAuth (previously built in 0050, fully reverted in
-- 0051 back to a plain "employer clicks Book a meeting, we record a
-- meetings row" flow) as an ADDITION alongside that flow, not a
-- replacement: calendly_url and every existing meetings row keep working
-- exactly as before for anyone who hasn't connected via OAuth.
--
-- calendly_tokens is service-role-only (RLS enabled, no policies) since the
-- access/refresh tokens never need to reach the client — the frontend only
-- ever sees candidate_profiles.calendly_scheduling_url/calendly_username.
create table public.calendly_tokens (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade unique,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  calendly_user_uri text not null,
  calendly_organization_uri text not null,
  webhook_subscription_uri text,
  connected_at timestamptz not null default now()
);

alter table public.calendly_tokens enable row level security;

-- calendly_scheduling_url/calendly_username are purely additive and
-- nullable — the existing manual calendly_url column is untouched, so the
-- handful of candidates who pasted a manual link keep their "Book a
-- meeting" button working until they reconnect via OAuth.
alter table public.candidate_profiles
  add column calendly_scheduling_url text,
  add column calendly_username text;

-- Backs the webhook side (api/calendly-webhook.js): a meetings row now
-- moves from 'pending' (recorded on the employer's "Book a meeting" click,
-- same as always) to 'confirmed' once Calendly reports the invitee
-- actually scheduled it, then to 'cancelled' on a genuine cancellation (a
-- reschedule updates start_time/timezone in place instead of touching
-- status). Every existing row defaults to 'pending' with everything else
-- null/false — nothing here changes how those rows already read.
alter table public.meetings
  add column status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  add column start_time timestamptz,
  add column timezone text,
  add column calendly_event_uri text unique,
  add column calendly_invitee_uri text unique,
  add column reminder_sent boolean not null default false;

create index on public.meetings (candidate_id, status);
