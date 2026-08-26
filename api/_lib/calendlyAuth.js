// Returns a valid Calendly access token for a candidate, transparently
// refreshing it via the stored refresh_token first if the current one is
// expired or about to expire. Calendly rotates the refresh token on every
// use, so both the new access and refresh token are persisted back to
// calendly_tokens after a refresh — the old refresh_token stops working
// once this happens.

import { unwrap } from './db.js'

const EXPIRY_BUFFER_MS = 60 * 1000

export async function getValidCalendlyAccessToken(supabase, candidateId) {
  const row = unwrap(await supabase.from('calendly_tokens').select('*').eq('candidate_id', candidateId).single())

  const expiresAt = new Date(row.token_expires_at).getTime()
  if (expiresAt - EXPIRY_BUFFER_MS > Date.now()) {
    return row.access_token
  }

  const res = await fetch('https://auth.calendly.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.CALENDLY_CLIENT_ID,
      client_secret: process.env.CALENDLY_CLIENT_SECRET,
      refresh_token: row.refresh_token,
    }),
  })
  if (!res.ok) throw new Error(`Calendly token refresh failed (${res.status}): ${await res.text()}`)
  const tokens = await res.json()

  unwrap(
    await supabase
      .from('calendly_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq('candidate_id', candidateId),
  )

  return tokens.access_token
}
