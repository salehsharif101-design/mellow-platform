-- Public buckets serve individual files via /storage/v1/object/public/... which
-- bypasses RLS entirely, so direct-URL access (getPublicUrl()) is unaffected by
-- this change. These SELECT policies only gate the list/query endpoints, which
-- the app never uses — dropping them stops anon from enumerating bucket contents
-- (e.g. every candidate's video folder UUIDs) via /storage/v1/object/list/{bucket}.
drop policy if exists "anyone can view candidate videos" on storage.objects;
drop policy if exists "anyone can view avatars" on storage.objects;
drop policy if exists "anyone can view company logos" on storage.objects;
