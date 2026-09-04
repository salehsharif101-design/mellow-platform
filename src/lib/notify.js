import { supabase } from './supabase.js'

// Fire-and-forget call to /api/email. Never blocks or breaks the calling
// flow — a failed notification email should not stop a signup, message,
// application, or shortlist from succeeding. The endpoint requires a valid
// session (see api/email.js), so every call site must run after sign-in.
export async function notify(action, payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  fetch('/api/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  }).catch(() => {})
}
