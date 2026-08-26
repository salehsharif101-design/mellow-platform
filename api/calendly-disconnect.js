// Vercel serverless function. Hit by the "Disconnect Calendly" button.
// Best-effort revokes the webhook subscription and OAuth grant on
// Calendly's side, then always clears Mellow's own stored state regardless
// of whether that revoke succeeded — a candidate should never end up stuck
// "connected" locally just because Calendly's side had already gone stale
// (token already invalid, subscription already deleted, etc).
//
// candidate_profiles.calendly_url is deliberately left untouched —
// disconnecting only turns off the deeper OAuth/webhook integration, not
// necessarily the booking link itself, which the candidate may still want.

import { createClient } from '@supabase/supabase-js'
import { getServiceClient, unwrap } from './_lib/db.js'
import { getValidCalendlyAccessToken } from './_lib/calendlyAuth.js'

function getAnonClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
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

    const { data: tokenRow, error: tokenRowError } = await supabase
      .from('calendly_tokens')
      .select('*')
      .eq('candidate_id', candidate.id)
      .maybeSingle()
    if (tokenRowError) throw new Error(tokenRowError.message)

    if (tokenRow) {
      try {
        const accessToken = await getValidCalendlyAccessToken(supabase, candidate.id)
        if (tokenRow.webhook_subscription_uri) {
          await fetch(tokenRow.webhook_subscription_uri, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        }
        await fetch('https://auth.calendly.com/oauth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.CALENDLY_CLIENT_ID,
            client_secret: process.env.CALENDLY_CLIENT_SECRET,
            token: accessToken,
          }),
        })
      } catch (err) {
        console.error('Calendly revoke/webhook-delete failed (clearing local state anyway):', err.message)
      }

      unwrap(await supabase.from('calendly_tokens').delete().eq('candidate_id', candidate.id))
    }

    unwrap(
      await supabase
        .from('candidate_profiles')
        .update({ calendly_connected: false, calendly_username: null })
        .eq('id', candidate.id),
    )

    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
