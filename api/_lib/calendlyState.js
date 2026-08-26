// Signs and verifies the OAuth `state` param carried through Calendly's
// authorization redirect. The candidate is authenticated (Bearer token)
// when api/calendly-connect.js issues this, but Calendly's callback
// (api/calendly-callback.js) is a plain browser GET redirect with no
// session — state is what lets the callback trust which candidate this
// authorization belongs to without one, while still being tamper-proof and
// bounded to a short window (a raw, unsigned candidateId would let anyone
// who intercepts or guesses the callback URL attribute a Calendly
// connection to a candidate of their choosing).
//
// Also carries the PKCE code_verifier through the same round trip —
// Calendly's token endpoint requires it (confirmed live: it 400s with
// "Missing required parameter: code_verifier" without one), and since the
// connect and callback steps are separate stateless serverless
// invocations, state is the only channel available to hand it back.
// JSON-encoding the payload before signing (rather than joining fields
// with a plain delimiter) avoids ambiguity from code_verifier's own
// allowed character set (RFC 7636: A-Za-z0-9-._~) potentially colliding
// with whatever delimiter was chosen.

import crypto from 'node:crypto'

const STATE_TTL_MS = 10 * 60 * 1000

export function signState(candidateId, codeVerifier) {
  const encodedPayload = Buffer.from(JSON.stringify({ candidateId, codeVerifier, ts: Date.now() })).toString('base64url')
  const sig = crypto.createHmac('sha256', process.env.CALENDLY_CLIENT_SECRET).update(encodedPayload).digest('hex')
  return `${encodedPayload}.${sig}`
}

// Returns { candidateId, codeVerifier } on success, null on any invalid,
// tampered, or expired state.
export function verifyState(state) {
  if (!state) return null
  try {
    const [encodedPayload, sig] = state.split('.')
    if (!encodedPayload || !sig) return null

    const expected = crypto.createHmac('sha256', process.env.CALENDLY_CLIENT_SECRET).update(encodedPayload).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf = Buffer.from(sig, 'hex')
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) return null

    const { candidateId, codeVerifier, ts } = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString())
    if (!candidateId || !codeVerifier || !ts) return null
    if (Date.now() - ts > STATE_TTL_MS) return null

    return { candidateId, codeVerifier }
  } catch {
    return null
  }
}
