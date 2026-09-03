import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

// Captured synchronously, before the client below gets a chance to silently
// swap the active session for whatever's in the URL — an email confirmation,
// password recovery, or other auth link carries its own session tokens in
// the hash, and the client below adopts them as soon as it initializes. This
// is the only reliable way for a page to know which account, if any, was
// already signed in on this device right before that happens, so it can
// tell the difference between "confirming my own account" and "someone else
// clicked a link meant for a different account on my browser."
export const previousSession = (() => {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const stored = JSON.parse(localStorage.getItem(key))
    return stored?.access_token && stored?.refresh_token && stored?.user ? stored : null
  } catch {
    return null
  }
})()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
