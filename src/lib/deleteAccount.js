import { supabase } from './supabase.js'

export async function deleteAccount() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to delete account')
  }

  // The account (and its auth user) no longer exists server-side at this
  // point, but the client still holds a session token — clear it so the UI
  // doesn't think it's still logged in.
  await supabase.auth.signOut()
}
