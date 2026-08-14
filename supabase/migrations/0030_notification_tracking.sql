-- Tracking columns for in-app unread-notification badges. messages.read_at
-- already exists (migration 0001) and covers the messages badge; these two
-- cover "new since I last checked" for applications (employer) and
-- shortlists/profile views (candidate).
alter table public.employer_profiles
  add column last_viewed_applications_at timestamptz;

alter table public.candidate_profiles
  add column last_viewed_dashboard_at timestamptz;
