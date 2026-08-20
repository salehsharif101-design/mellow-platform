// Vercel serverless function. Public, unauthenticated endpoint used by the
// login page to check, before ever attempting Supabase auth, whether an
// email belongs to a team member who was removed. This has to happen first:
// once a removed member's Supabase Auth account is deleted, signing in with
// their old credentials fails with a generic "Invalid login credentials"
// error - by then it's too late to show the real reason, since the account
// (and any RLS-gated row keyed off it) may already be gone. Checking here
// instead, by email against employer_team_members directly with the
// service role, works regardless of whether that auth account still exists.
//
// Only ever returns a boolean - nothing else about the account - so this
// doesn't enable any broader enumeration than the login form's own
// "invalid credentials" response already does.

import { createClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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
    const { data, error } = await getServiceClient()
      .from('employer_team_members')
      .select('id')
      .ilike('invited_email', email)
      .eq('status', 'removed')
      .maybeSingle()
    if (error) throw error

    res.statusCode = 200
    res.end(JSON.stringify({ removed: !!data }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
