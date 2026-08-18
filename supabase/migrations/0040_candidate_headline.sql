-- Adds a free-form "headline" field replacing the old three-word
-- self-description in the product. three_words is left in place rather
-- than dropped/renamed — no code reads it after this migration, but there's
-- no reason to force a destructive change for a column that costs nothing
-- sitting unused.

alter table public.candidate_profiles
  add column headline text;
