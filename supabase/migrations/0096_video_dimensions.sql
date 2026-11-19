-- Stores the pixel dimensions of each intro video so VideoPlayCard can size
-- its box to the video's real shape before anything loads. On touch devices
-- the video uses preload="none", so without these the card starts as a
-- default portrait box and snaps to its real shape on play.
--
-- Captured from the HTML video element's videoWidth / videoHeight when the
-- video is uploaded (candidate onboarding + edit profile, and employer edit
-- profile). Existing rows stay null until their video is next uploaded, and
-- a null pair just falls back to the previous behaviour.
--
-- Adds columns to existing tables, so no new grants are needed.

alter table public.candidate_profiles
  add column if not exists intro_video_width integer,
  add column if not exists intro_video_height integer;

alter table public.employer_profiles
  add column if not exists intro_video_width integer,
  add column if not exists intro_video_height integer;
