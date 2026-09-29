// Vercel serverless function backing "Disconnect" on the connected-Calendly
// state in candidate Edit Profile. Deletes the webhook subscription from
// Calendly first (best-effort — a candidate should still be able to
// disconnect even if Calendly's API is unreachable), then clears the
// tokens and scheduling url so the UI falls back to the "Connect your
// Calendly" button. calendly_url (the old manual-link column) is untouched.

import { createClient } from '@supabase/supabase-js'
import { getServiceClient, unwrap } from './_lib/db.js'
import { getValidAccessToken, deleteWebhookSubscription } from './_lib/calendly.js'

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

  const supabase = getServiceClient()

  try {
    const candidate = unwrap(
      await supabase.from('candidate_profiles').select('id').eq('user_id', userData.user.id).single(),
    )

    const tokenRow = unwrap(
      await supabase
        .from('calendly_tokens')
        .select('webhook_subscription_uri')
        .eq('candidate_id', candidate.id)
        .maybeSingle(),
    )

    if (tokenRow?.webhook_subscription_uri) {
      try {
        const accessToken = await getValidAccessToken(supabase, candidate.id)
        await deleteWebhookSubscription(accessToken, tokenRow.webhook_subscription_uri)
      } catch (err) {
        console.error('Failed to delete Calendly webhook subscription on disconnect:', err.message)
      }
    }

    unwrap(await supabase.from('calendly_tokens').delete().eq('candidate_id', candidate.id))
    unwrap(
      await supabase
        .from('candidate_profiles')
        .update({ calendly_scheduling_url: null, calendly_username: null })
        .eq('id', candidate.id),
    )

    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
