// The exact redirect_uri registered on the Calendly OAuth app
// (https://beta.joinmellow.xyz/api/calendly-oauth/callback) — Calendly lands
// the browser here directly after the candidate authorizes (or denies)
// access, so this runs unauthenticated by Supabase's session; the signed
// `state` param (minted by ../calendly-oauth.js) is what ties this request
// back to a specific candidate.

import { getServiceClient, unwrap } from '../_lib/db.js'
import { SITE_URL } from '../_lib/email-template.js'
import {
  verifyState,
  exchangeCodeForToken,
  getCurrentCalendlyUser,
  registerWebhookSubscription,
} from '../_lib/calendly.js'

function redirect(res, returnTo, status) {
  const path = returnTo === 'onboarding' ? '/onboarding' : '/profile/edit'
  res.statusCode = 302
  res.setHeader('Location', `${SITE_URL}${path}?calendly=${status}`)
  res.end()
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams
  const code = params.get('code')
  const state = params.get('state')
  const oauthError = params.get('error')

  // Calendly round-trips `state` even on a denial, so it's parsed before
  // branching on oauthError — otherwise a candidate who declines from the
  // onboarding wizard would incorrectly land back on /profile/edit instead
  // of resuming Step 4.
  const parsedState = state && verifyState(state)
  const returnTo = parsedState?.returnTo

  if (oauthError) {
    redirect(res, returnTo, 'denied')
    return
  }

  if (!parsedState || !code) {
    redirect(res, returnTo, 'error')
    return
  }

  const candidateId = parsedState.candidateId

  const supabase = getServiceClient()

  try {
    const token = await exchangeCodeForToken(code)
    const { resource: calendlyUser } = await getCurrentCalendlyUser(token.access_token)

    let webhookSubscriptionUri = null
    try {
      const { resource: subscription } = await registerWebhookSubscription({
        accessToken: token.access_token,
        organizationUri: calendlyUser.current_organization,
        userUri: calendlyUser.uri,
      })
      webhookSubscriptionUri = subscription.uri
    } catch (webhookErr) {
      // Don't fail the whole connection over this — the candidate is still
      // usefully connected (scheduling_url works, "Book a meeting" works),
      // they just won't get automatic booking confirmations until this is
      // retried. Surfaced in logs rather than swallowed silently.
      console.error('Calendly webhook subscription registration failed:', webhookErr.message)
    }

    unwrap(
      await supabase.from('calendly_tokens').upsert(
        {
          candidate_id: candidateId,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          calendly_user_uri: calendlyUser.uri,
          calendly_organization_uri: calendlyUser.current_organization,
          webhook_subscription_uri: webhookSubscriptionUri,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id' },
      ),
    )

    unwrap(
      await supabase
        .from('candidate_profiles')
        .update({
          calendly_scheduling_url: calendlyUser.scheduling_url,
          calendly_username: calendlyUser.slug,
        })
        .eq('id', candidateId),
    )

    redirect(res, returnTo, 'connected')
  } catch (err) {
    console.error('Calendly OAuth callback failed:', err.message)
    redirect(res, returnTo, 'error')
  }
}
