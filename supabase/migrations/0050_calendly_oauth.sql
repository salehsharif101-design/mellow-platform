-- Backs the Calendly OAuth integration (api/calendly-connect.js,
-- api/calendly-callback.js, api/calendly-disconnect.js) that replaces the
-- previous manual-webhook-setup flow with candidates connecting their own
-- Calendly account and Mellow registering the webhook automatically.
--
-- calendly_tokens holds the actual OAuth credentials and is never exposed
-- to the client — RLS is enabled with no policies at all (deny-all for
-- anon/authenticated), since every read/write goes through service-role
-- serverless functions. The candidate-visible connection status lives
-- denormalized on candidate_profiles instead (calendly_connected,
-- calendly_username), so the frontend never needs to query this table.
create table public.calendly_tokens (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (id) on delete cascade unique,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  calendly_user_uri text not null,
  calendly_organization_uri text not null,
  webhook_subscription_uri text,
  webhook_signing_key text,
  connected_at timestamptz not null default now()
);

alter table public.calendly_tokens enable row level security;

alter table public.candidate_profiles
  add column calendly_connected boolean not null default false,
  add column calendly_username text;
