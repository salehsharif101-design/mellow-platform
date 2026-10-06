// Auth helpers for api/admin.js — password + TOTP two-factor, and the signed
// session tokens issued once both pass. Prefixed-underscore directory so
// Vercel does not turn this into a route.
//
// Tokens are stateless (HMAC-signed, carrying their own expiry) since
// serverless functions share no memory between invocations. The signing key
// is derived from ADMIN_PASSWORD *and* ADMIN_TOTP_SECRET, so rotating either
// one invalidates every outstanding session — and so does turning 2FA on or
// off, which means a session minted while 2FA was still off can't survive
// the moment ADMIN_TOTP_SECRET gets set.

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { verifySync } from 'otplib'

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000
// Only has to outlive the time it takes to open an authenticator app.
export const PENDING_TTL_MS = 5 * 60 * 1000

// Hashing both sides first gives timingSafeEqual equal-length inputs
// regardless of what the caller sent, without leaking the real length.
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a ?? '')).digest()
  const hb = createHash('sha256').update(String(b ?? '')).digest()
  return timingSafeEqual(ha, hb)
}

export function passwordIsValid(candidate) {
  return Boolean(candidate) && safeEqual(candidate, process.env.ADMIN_PASSWORD)
}

export function totpEnabled() {
  return Boolean(process.env.ADMIN_TOTP_SECRET)
}

function signingKey() {
  return createHash('sha256')
    .update(`${process.env.ADMIN_PASSWORD}\n${process.env.ADMIN_TOTP_SECRET || ''}`)
    .digest()
}

function sign(payload) {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url')
}

// purpose keeps the two token kinds from being interchangeable: a
// password-only "pending" token must never be accepted as a session.
export function issueToken(purpose, ttlMs) {
  const expiresAt = Date.now() + ttlMs
  const payload = Buffer.from(JSON.stringify({ p: purpose, exp: expiresAt })).toString('base64url')
  return { token: `${payload}.${sign(payload)}`, expiresAt }
}

export function verifyToken(token, purpose) {
  if (typeof token !== 'string') return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  if (!safeEqual(signature, sign(payload))) return false
  try {
    const { p, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return p === purpose && typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}

// epochTolerance 30 accepts the code from one 30-second step either side of
// now, so a phone clock that's slightly off doesn't lock the admin out.
// A malformed secret makes otplib throw rather than return invalid — treated
// as a failed check, not a crash.
export function totpCodeIsValid(secret, code) {
  const cleaned = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(cleaned)) return false
  try {
    return verifySync({ secret, token: cleaned, epochTolerance: 30 }).valid === true
  } catch {
    return false
  }
}
