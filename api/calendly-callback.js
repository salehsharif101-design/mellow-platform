// Vercel serverless function. Calendly redirects the candidate's browser
// here (a plain GET) after they approve or deny the authorization request
// — CALENDLY_REDIRECT_URI must point at this exact URL
// (https://beta.joinmellow.xyz/api/calendly-callback) in both Calendly's
// app settings and the env var, or the token exchange below is rejected.
//
// On success this: exchanges the code for tokens, fetches the candidate's
// Calendly user/org info, registers a per-candidate webhook subscription
// (with a signing key generated here and handed to Calendly, rather than
// depending on Calendly returning one — this project's contract with
// Calendly's API for that isn't independently verified against a live
// payload yet), stores everything, and redirects back into the app.

import crypto from 'node:crypto'
import { verifyState } from './_lib/calendlyState.js'
import { getServiceClient, unwrap } from './_lib/db.js'
import { SITE_URL } from './_lib/email-template.js'

async function exchangeCodeForTokens(code, codeVerifier) {
  const res = await fetch('https://auth.calendly.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.CALENDLY_CLIENT_ID,
      client_secret: process.env.CALENDLY_CLIENT_SECRET,
      code,
      redirect_uri: process.env.CALENDLY_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })
  if (!res.ok) throw new Error(`Calendly token exchange failed (${res.status}): ${await res.text()}`)
  return res.json()
}

async function fetchCalendlyUser(accessToken) {
  const res = await fetch('https://api.calendly.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Calendly /users/me failed (${res.status}): ${await res.text()}`)
  const { resource } = await res.json()
  return resource
}

async function registerWebhook(accessToken, candidateId, userUri, organizationUri) {
  const signingKey = crypto.randomBytes(32).toString('hex')
  const res = await fetch('https://api.calendly.com/webhook_subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `${SITE_URL}/api/calendly-webhook?candidate=${candidateId}`,
      events: ['invitee.created'],
      organization: organizationUri,
      user: userUri,
      scope: 'user',
      signing_key: signingKey,
    }),
  })
  if (!res.ok) throw new Error(`Calendly webhook registration failed (${res.status}): ${await res.text()}`)
  const { resource } = await res.json()
  return { subscriptionUri: resource.uri, signingKey }
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  function redirectTo(path) {
    res.statusCode = 302
    res.setHeader('Location', `${SITE_URL}${path}`)
    res.end()
  }

  if (oauthError) {
    redirectTo('/profile/edit?calendly=error')
    return
  }

  const stateResult = verifyState(state)
  if (!code || !stateResult) {
    redirectTo('/profile/edit?calendly=error')
    return
  }
  const { candidateId, codeVerifier } = stateResult

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier)
    const calendlyUser = await fetchCalendlyUser(tokens.access_token)
    const { subscriptionUri, signingKey } = await registerWebhook(
      tokens.access_token,
      candidateId,
      calendlyUser.uri,
      calendlyUser.current_organization,
    )

    const supabase = getServiceClient()

    unwrap(
      await supabase.from('calendly_tokens').upsert(
        {
          candidate_id: candidateId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          calendly_user_uri: calendlyUser.uri,
          calendly_organization_uri: calendlyUser.current_organization,
          webhook_subscription_uri: subscriptionUri,
          webhook_signing_key: signingKey,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id' },
      ),
    )

    unwrap(
      await supabase
        .from('candidate_profiles')
        .update({
          calendly_connected: true,
          calendly_username: calendlyUser.name,
          // Keeps the existing booking flow (CalendlyModal/BookMeetingButton,
          // which just embeds candidate_profiles.calendly_url) working
          // without the candidate having to separately paste their link —
          // only overwritten when Calendly actually returns one.
          ...(calendlyUser.scheduling_url ? { calendly_url: calendlyUser.scheduling_url } : {}),
        })
        .eq('id', candidateId),
    )

    redirectTo('/profile/edit?calendly=connected')
  } catch (err) {
    console.error('Calendly OAuth callback failed:', err.message)
    redirectTo('/profile/edit?calendly=error')
  }
}
