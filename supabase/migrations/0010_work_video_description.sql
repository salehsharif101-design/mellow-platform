-- Optional short description shown alongside a work video's label,
-- captured by the inline "Add a work video" upload modal.

alter table public.candidate_videos
  add column description text;
