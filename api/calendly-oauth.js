// Vercel serverless function backing the "Connect your Calendly" button in
// candidate Edit Profile. Mints a signed, short-lived state and returns the
// Calendly OAuth authorize URL for the browser to navigate to directly —
// the actual token exchange happens once Calendly redirects back to
// api/calendly-oauth/callback.js, not here.

import { createClient } from '@supabase/supabase-js'
import { getServiceClient, unwrap } from './_lib/db.js'
import { buildAuthorizeUrl } from './_lib/calendly.js'

function getAnonClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const authToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!authToken) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Missing authorization token' }))
    return
  }
  const { data: userData, error: userError } = await getAnonClient().auth.getUser(authToken)
  if (userError || !userData?.user) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Invalid or expired session' }))
    return
  }

  try {
    const returnToParam = new URL(req.url, 'http://localhost').searchParams.get('returnTo')
    const returnTo = returnToParam === 'onboarding' ? 'onboarding' : 'edit'
    const supabase = getServiceClient()
    const candidate = unwrap(
      await supabase.from('candidate_profiles').select('id').eq('user_id', userData.user.id).single(),
    )
    const url = buildAuthorizeUrl(candidate.id, returnTo)
    res.statusCode = 200
    res.end(JSON.stringify({ url }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
