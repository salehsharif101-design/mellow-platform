// Vercel serverless function. Public, unauthenticated endpoint used by the
// signup form to give a clear "this email is already registered as a
// candidate/employer" error before attempting Supabase auth signUp — which
// otherwise returns a fake "success" for duplicate emails (an anti-enumeration
// measure) with no indication of the existing account's type.
//
// Only ever returns whether an exact email is taken and its account type —
// nothing else about the account — so this doesn't enable broader user
// enumeration beyond what the signup form itself already requires.

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
      .from('users')
      .select('user_type')
      .ilike('email', email)
      .maybeSingle()
    if (error) throw error

    res.statusCode = 200
    res.end(JSON.stringify({ exists: !!data, userType: data?.user_type || null }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
