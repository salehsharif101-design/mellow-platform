-- Backs the "your first applicant is here" email (api/email.js's
-- sendApplicationNotification) — a one-time nudge sent to the employer
-- account owner, introducing Ask a Video Question right when they get
-- their very first application across every role they've ever posted.
-- Defaults to false for every existing row, same as the other one-time
-- "*_email_sent"/"*_nudge_sent" flags already on this table.
alter table public.employer_profiles
  add column first_application_email_sent boolean not null default false;
