-- The employer applicant-management view uses New / Reviewing / Shortlisted
-- / Rejected. 'applied' (displayed as "New") and 'shortlisted' already exist
-- on application_status; this adds the two missing values. Postgres enums
-- only support adding values, not removing, so the unused legacy
-- 'contacted' / 'hired' values are left in place.
alter type application_status add value if not exists 'reviewing';
alter type application_status add value if not exists 'rejected';
