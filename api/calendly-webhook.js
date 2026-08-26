// Calendly v2 webhook receiver for the post-meeting follow-up loop.
// Handles the "invitee.created" event, which Calendly fires when someone
// books a meeting through a scheduling link.
//
// Webhooks are registered per candidate by api/calendly-callback.js when
// they connect their Calendly account via OAuth, with the callback URL
// itself carrying `?candidate=<id>` — that's what lets this handler go
// straight to the right row in calendly_tokens for both the signing key
// (which candidate's secret to verify against) and the candidate's
// identity, without needing to parse it back out of the payload. A
// `candidate` param is required now; CALENDLY_WEBHOOK_SECRET only remains
// as a fallback for a webhook someone set up manually against the old
// single-global-secret scheme, before per-candidate OAuth existed.
//
// Signature verification follows Calendly's documented scheme: the
// Calendly-Webhook-Signature header is `t=<unix seconds>,v1=<hex hmac>`,
// where the hmac is HMAC-SHA256(<signing key>, `${t}.${rawBody}`). That
// requires the exact raw, unparsed request bytes, so Vercel's automatic
// JSON body parsing is disabled for this function below and the body is
// read and verified before ever being JSON.parse'd.

import crypto from 'node:crypto'
import { getServiceClient, unwrap } from './_lib/db.js'

export const config = {
  api: { bodyParser: false },
}

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function verifySignature(rawBody, header, secret) {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k, v]
    }),
  )
  const { t, v1 } = parts
  if (!t || !v1) return false
  // Rejects a replayed/stale signature rather than just a forged one.
  if (Math.abs(Date.now() / 1000 - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(v1, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}

async function findEmployerByEmail(supabase, email) {
  const { data: user, error: userErr } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
  if (userErr) throw new Error(userErr.message)
  if (!user) return null
  const { data: employer, error: empErr } = await supabase
    .from('employer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (empErr) throw new Error(empErr.message)
  return employer?.id || null
}

async function findCandidateByEmail(supabase, email) {
  const { data: user, error: userErr } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
  if (userErr) throw new Error(userErr.message)
  if (!user) return null
  const { data: candidate, error: candErr } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (candErr) throw new Error(candErr.message)
  return candidate?.id || null
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const rawBody = await readRawBody(req)
  const candidateIdParam = new URL(req.url, 'http://localhost').searchParams.get('candidate')

  try {
    const supabase = getServiceClient()

    let signingSecret = process.env.CALENDLY_WEBHOOK_SECRET
    if (candidateIdParam) {
      const { data: tokenRow, error: tokenRowError } = await supabase
        .from('calendly_tokens')
        .select('webhook_signing_key')
        .eq('candidate_id', candidateIdParam)
        .maybeSingle()
      if (tokenRowError) throw new Error(tokenRowError.message)
      // No connected candidate at this id (disconnected since, or a stale
      // subscription Calendly never got told to stop calling) — nothing to
      // verify against, so there's nothing legitimate this request could be.
      if (!tokenRow?.webhook_signing_key) {
        res.statusCode = 401
        res.end(JSON.stringify({ error: 'Unknown or disconnected candidate' }))
        return
      }
      signingSecret = tokenRow.webhook_signing_key
    }

    if (signingSecret) {
      const valid = verifySignature(rawBody, req.headers['calendly-webhook-signature'], signingSecret)
      if (!valid) {
        res.statusCode = 401
        res.end(JSON.stringify({ error: 'Invalid signature' }))
        return
      }
    }

    let body
    try {
      body = JSON.parse(rawBody)
    } catch {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    // Anything other than invitee.created (e.g. invitee.canceled, if that
    // event type is ever subscribed to as well) is acknowledged and
    // dropped rather than erroring — a non-2xx response makes Calendly
    // retry, and there's nothing to retry for an event we don't act on.
    if (body.event !== 'invitee.created') {
      res.statusCode = 200
      res.end(JSON.stringify({ ignored: true }))
      return
    }

    const payload = body.payload || {}
    const scheduledEvent = payload.scheduled_event || {}
    const inviteeEmail = payload.email
    const eventUri = scheduledEvent.uri || payload.event
    const scheduledAt = scheduledEvent.start_time

    // Per how booking actually works in this product: an employer views a
    // candidate's public profile and books time on the CANDIDATE's own
    // Calendly link, so the invitee (who filled in the booking form) is the
    // employer. The candidate is whoever this webhook subscription belongs
    // to — known directly from the URL's ?candidate= param now, rather than
    // needing to parse the event host back out of the payload.
    let candidateId = candidateIdParam
    if (!candidateId) {
      // Fallback path for a webhook registered the old way, before
      // per-candidate OAuth existed — see the file header.
      const hostEmail = scheduledEvent.event_memberships?.[0]?.user_email
      if (hostEmail) candidateId = await findCandidateByEmail(supabase, hostEmail)
    }

    if (!inviteeEmail || !candidateId || !eventUri || !scheduledAt) {
      res.statusCode = 200
      res.end(JSON.stringify({ ignored: true, reason: 'missing expected fields' }))
      return
    }

    const employerId = await findEmployerByEmail(supabase, inviteeEmail)

    if (!employerId) {
      res.statusCode = 200
      res.end(JSON.stringify({ ignored: true, reason: 'could not match employer to a Mellow account' }))
      return
    }

    unwrap(
      await supabase.from('meetings').upsert(
        {
          employer_id: employerId,
          candidate_id: candidateId,
          scheduled_at: scheduledAt,
          calendly_event_uri: eventUri,
        },
        { onConflict: 'calendly_event_uri' },
      ),
    )

    res.statusCode = 200
    res.end(JSON.stringify({ success: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
