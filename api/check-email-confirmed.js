// Vercel serverless function. Public, unauthenticated endpoint used by the
// "Resend confirmation email" flow (AuthContext.jsx's resendConfirmation)
// before it calls Supabase's own auth.resend().
//
// Supabase's resend() is deliberately silent about *why* — same anti-
// enumeration reasoning as signUp() and check-email.js's own comment — so a
// resend request for an email whose account is already confirmed returns a
// clean, error-free success with no indication that nothing was actually
// sent. The UI has no way to tell that apart from a genuine send without
// asking here first: this is what let the "Resend confirmation email"
// button show its normal countdown while silently doing nothing for an
// already-confirmed account (a stale "check your inbox" tab left open
// after already confirming in another tab, or a re-clicked old link).
//
// Only ever returns whether an exact email's account is confirmed — same
// enumeration surface as check-email.js already exposes (email taken or
// not), just one bit more.

import { getServiceClient } from './_lib/db.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const email = (body.email || '').trim()
  if (!EMAIL_RE.test(email)) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'A valid email is required' }))
    return
  }

  try {
    const supabase = getServiceClient()
    const { data: user, error } = await supabase.from('users').select('id').ilike('email', email).maybeSingle()
    if (error) throw error

    if (!user) {
      res.statusCode = 200
      res.end(JSON.stringify({ confirmed: false }))
      return
    }

    // email_confirmed_at lives on auth.users, not the public users table
    // this project otherwise reads from — the admin API is the only way to
    // read it from a serverless function.
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id)
    if (authError) throw authError

    res.statusCode = 200
    res.end(JSON.stringify({ confirmed: Boolean(authUser?.user?.email_confirmed_at) }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
