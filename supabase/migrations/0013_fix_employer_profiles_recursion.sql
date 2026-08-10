-- Fixes "infinite recursion detected in policy for relation employer_profiles".
--
-- Root cause: migration 0012 added a SELECT policy on employer_profiles that
-- subqueries roles ("... exists (select 1 from roles where roles.employer_id
-- = employer_profiles.id ...)"). But roles already has a policy ("employers
-- manage own roles", from 0001_init.sql) that subqueries employer_profiles
-- right back ("employer_id in (select id from employer_profiles where
-- user_id = auth.uid())"). Two RLS-protected tables whose policies query
-- each other create infinite recursion the moment either table is queried.
--
-- Fix: drop any policy on employer_profiles that queries roles (by every
-- name this might currently exist under) and replace it with an
-- unconditional public-read policy. Company name/logo aren't sensitive data,
-- and a plain `using (true)` never queries another RLS-protected table, so
-- this class of recursion can't reoccur here regardless of what roles' own
-- policies do.
drop policy if exists "anyone can read employer profiles with active roles" on public.employer_profiles;
drop policy if exists "Public can view employer profiles with active roles" on public.employer_profiles;

create policy "anyone can read employer profiles"
  on public.employer_profiles for select
  using (true);
