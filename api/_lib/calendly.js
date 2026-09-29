// Shared Calendly API v2 + OAuth2 helpers used by api/calendly-oauth.js,
// api/calendly-oauth/callback.js, api/calendly-disconnect.js, and
// api/calendly-webhook.js. Prefixed-underscore directory so Vercel does not
// turn this into a route.

import { createHmac, timingSafeEqual } from 'crypto'
import { getServiceClient, unwrap } from './db.js'
import { SITE_URL } from './email-template.js'

const AUTH_BASE = 'https://auth.calendly.com'
const API_BASE = 'https://api.calendly.com'

export const CALENDLY_REDIRECT_URI = `${SITE_URL}/api/calendly-oauth/callback`

// The state param round-trips through Calendly's own redirect (a plain
// browser navigation, with no Supabase session available server-side when
// it lands), so it has to carry the candidate id itself rather than just a
// random anti-CSRF token — but a candidate id alone would let anyone craft
// a callback request and attach a stolen/replayed code to someone else's
// profile. Signing it with the OAuth client secret (already a secret
// scoped to exactly this integration, so no separate signing key needed)
// means only a state minted by our own /api/calendly-oauth endpoint can
// ever verify, and the 10-minute expiry keeps a leaked authorize URL from
// being useful for long.
const STATE_TTL_MS = 10 * 60 * 1000

function stateSecret() {
  const secret = process.env.CALENDLY_CLIENT_SECRET
  if (!secret) throw new Error('CALENDLY_CLIENT_SECRET is not configured on the server')
  return secret
}

// returnTo travels inside the signed state (rather than as its own query
// param on the redirect_uri, which Calendly requires to match exactly what
// was registered) so the callback knows whether to land the candidate back
// on the onboarding wizard (still on Step 4, mid-wizard) or on the real
// Edit Profile page — a candidate id alone isn't enough to tell those apart.
export function signState(candidateId, returnTo) {
  const payload = `${candidateId}.${returnTo}.${Date.now() + STATE_TTL_MS}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyState(state) {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [candidateId, returnTo, expiresAt, sig] = decoded.split('.')
    if (!candidateId || !returnTo || !expiresAt || !sig) return null
    const expected = createHmac('sha256', stateSecret()).update(`${candidateId}.${returnTo}.${expiresAt}`).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
    if (Date.now() > Number(expiresAt)) return null
    return { candidateId, returnTo }
  } catch {
    return null
  }
}

export function buildAuthorizeUrl(candidateId, returnTo) {
  const clientId = process.env.CALENDLY_CLIENT_ID
  if (!clientId) throw new Error('CALENDLY_CLIENT_ID is not configured on the server')
  // Calendly's v2 OAuth apps have no scope parameter — a connected app gets
  // read/webhook access to whatever the authorizing user's own account
  // exposes (their scheduling links, their events, their own webhook
  // subscriptions), which is exactly "read their scheduling URL and receive
  // webhook events for their bookings" with nothing extra to request.
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: CALENDLY_REDIRECT_URI,
    state: signState(candidateId, returnTo),
  })
  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`
}

async function tokenRequest(body) {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.CALENDLY_CLIENT_ID,
      client_secret: process.env.CALENDLY_CLIENT_SECRET,
      ...body,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendly token request failed (${res.status}): ${text}`)
  }
  return res.json()
}

export function exchangeCodeForToken(code) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: CALENDLY_REDIRECT_URI })
}

function refreshToken(refresh_token) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token })
}

async function calendlyApiFetch(path, accessToken, options = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendly API request failed (${res.status}): ${text}`)
  }
  return res.status === 204 ? null : res.json()
}

// GET /users/me — the connected account's own profile: uri (used to match
// webhook payloads back to this candidate), current_organization, slug (used
// as the display username), and scheduling_url (the link "Book a meeting"
// now opens instead of the manual calendly_url text field).
export function getCurrentCalendlyUser(accessToken) {
  return calendlyApiFetch('/users/me', accessToken)
}

export function getScheduledEvent(accessToken, eventUri) {
  return calendlyApiFetch(eventUri, accessToken)
}

export function registerWebhookSubscription({ accessToken, organizationUri, userUri }) {
  return calendlyApiFetch('/webhook_subscriptions', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      url: `${SITE_URL}/api/calendly-webhook`,
      // No invitee.rescheduled event exists in Calendly's v2 API — a
      // reschedule instead delivers as an invitee.canceled for the old
      // booking (payload.new_invitee set) paired with an invitee.created
      // for the new one (payload.old_invitee set). api/calendly-webhook.js
      // uses those fields to tell a true cancellation from a reschedule.
      events: ['invitee.created', 'invitee.canceled'],
      organization: organizationUri,
      user: userUri,
      scope: 'user',
    }),
  })
}

export function deleteWebhookSubscription(accessToken, subscriptionUri) {
  return calendlyApiFetch(subscriptionUri, accessToken, { method: 'DELETE' })
}

// Returns a live access token for this candidate's connection, refreshing
// and persisting a new one first if the stored one has expired (or is
// close enough to it that it could expire mid-request) — called before any
// Calendly API call that needs to act as the candidate (webhook
// registration at connect time, deletion at disconnect time).
export async function getValidAccessToken(supabase, candidateId) {
  const tokenRow = unwrap(
    await supabase
      .from('calendly_tokens')
      .select('access_token, refresh_token, token_expires_at')
      .eq('candidate_id', candidateId)
      .single(),
  )
  const expiresAt = new Date(tokenRow.token_expires_at).getTime()
  if (expiresAt - Date.now() > 60 * 1000) return tokenRow.access_token

  const refreshed = await refreshToken(tokenRow.refresh_token)
  unwrap(
    await supabase
      .from('calendly_tokens')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('candidate_id', candidateId),
  )
  return refreshed.access_token
}

// Verifies the Calendly-Webhook-Signature header: "t=<unix_seconds>,
// v1=<hex hmac-sha256 of '{t}.{rawBody}'>". Calendly signs webhook
// deliveries with a single signing key shown in the organization's
// integrations settings (shared by every subscription under that org),
// not a per-subscription secret — CALENDLY_WEBHOOK_SIGNING_KEY here is
// expected to be that org-level key.
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  if (!signingKey || !signatureHeader) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key, value]
    }),
  )
  if (!parts.t || !parts.v1) return false

  const expected = createHmac('sha256', signingKey).update(`${parts.t}.${rawBody}`).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(parts.v1, 'hex')
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)
}

export { getServiceClient, unwrap }
