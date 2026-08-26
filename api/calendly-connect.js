// Vercel serverless function. Hit by the "Connect Calendly" button — the
// candidate is already authenticated in the browser, so this verifies
// their session token and returns Calendly's OAuth authorize URL with a
// signed state param, rather than doing the redirect itself (a plain
// button-click fetch can't carry the browser to a 302 the way a full page
// navigation from the returned URL can).
//
// Calendly requires PKCE (confirmed live against its real token endpoint)
// — code_verifier is generated here, its S256 challenge goes in the
// authorize URL, and the verifier itself rides through to
// api/calendly-callback.js inside the signed state param.

import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { signState } from './_lib/calendlyState.js'

function getAnonClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Missing authorization token' }))
    return
  }

  try {
    const { data: userData, error: userError } = await getAnonClient().auth.getUser(token)
    if (userError || !userData?.user) {
      res.statusCode = 401
      res.end(JSON.stringify({ error: 'Invalid or expired session' }))
      return
    }

    const supabase = getServiceClient()
    const { data: candidate, error: candidateError } = await supabase
      .from('candidate_profiles')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (candidateError) throw new Error(candidateError.message)
    if (!candidate) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'No candidate profile for this account' }))
      return
    }

    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const params = new URLSearchParams({
      client_id: process.env.CALENDLY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.CALENDLY_REDIRECT_URI,
      state: signState(candidate.id, codeVerifier),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    res.statusCode = 200
    res.end(JSON.stringify({ authorizeUrl: `https://auth.calendly.com/oauth/authorize?${params.toString()}` }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
