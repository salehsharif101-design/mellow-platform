-- Four employer accounts predate onboarding_completed_at (migration 0047), so
-- it was never stamped for them even though they have full profiles, posted
-- roles, and teammates. That left them looking like abandoned signups to
-- anything keyed off the column -- most visibly the weekly employer digest
-- (api/cron/weekly-digest.js only sends to employers with it set), which
-- would have stopped reaching them.
--
-- onboarding_completed_at is set to each account's own created_at, since
-- that's the best available proxy for when they onboarded.
--
-- work_video_nudge_sent = true in the same statement: work-video-nudge.js
-- emails anyone with onboarding_completed_at set 24h+ ago who hasn't been
-- nudged, so stamping alone would send these long-established accounts a
-- "check out candidates' work videos" welcome-style nudge.
--
-- Targeted by exact id (not company name, which isn't unique), and guarded
-- with onboarding_completed_at is null so re-running it can't overwrite a
-- real timestamp.
update public.employer_profiles
set
  onboarding_completed_at = created_at,
  work_video_nudge_sent = true
where onboarding_completed_at is null
  and id in (
    '2f8c9db7-160a-4506-9246-664b44a6fca3', -- 4SPOTS EVOLVE
    '78c40ba9-ca38-42a9-9803-1e55abb9acae', -- Farmsent
    'e8aa3ab6-348b-4794-93ab-b33d84365f9f', -- Serious Duck
    '30d91de6-dabc-4eca-903c-e2a5502c715f'  -- mellow
  );
