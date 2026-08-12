// Deletes every Storage object under a user's own folder (their exact user
// id as the path prefix) in each bucket that can hold their files. Used when
// permanently deleting an account, so avatars/videos/logos don't linger as
// orphaned files after the DB rows are gone. Best-effort: a missing bucket,
// an empty folder, or a failed list/remove call is swallowed rather than
// blocking the account deletion it's part of.
const BUCKETS = ['avatars', 'candidate-videos', 'company-logos', 'company-videos']

export async function deleteUserStorageFiles(supabase, userId) {
  if (!userId) return

  await Promise.all(
    BUCKETS.map(async (bucket) => {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(userId)
        if (!files || files.length === 0) return
        const paths = files.map((file) => `${userId}/${file.name}`)
        await supabase.storage.from(bucket).remove(paths)
      } catch {
        // Best-effort cleanup — never blocks or fails the account deletion.
      }
    }),
  )
}
