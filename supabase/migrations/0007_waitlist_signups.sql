-- Records joinmellow.xyz waitlist signups so they aren't lost to Resend's
-- send log alone. Written only by api/waitlist.js via the service role key
-- (a public, unauthenticated endpoint) — no RLS policies are defined, so
-- the table is unreachable by the anon/authenticated client roles entirely.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create index on public.waitlist_signups (created_at);

alter table public.waitlist_signups enable row level security;
