const SESSION_KEY = 'mellow_admin_session'
// The pre-2FA version of this panel kept the raw password in sessionStorage.
const LEGACY_PASSWORD_KEY = 'mellow_admin_pw'

// The server re-checks the token's signature and expiry on every call; the
// expiry check here is only so an obviously dead session doesn't flash the
// dashboard before the first request bounces.
export function getStoredSession() {
  try {
    sessionStorage.removeItem(LEGACY_PASSWORD_KEY)
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.token || Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function storeSession({ token, expiresAt }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }))
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
}

async function postAdmin(body, token) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

// Step 1. Resolves to either { twoFactorRequired: true, pendingToken } or,
// while 2FA isn't set up yet, a finished session { token, expiresAt }.
export function adminLogin(password) {
  return postAdmin({ action: 'login', password })
}

// Step 2. Resolves to a finished session { token, expiresAt }.
export function adminVerifyCode(pendingToken, code) {
  return postAdmin({ action: 'verify-2fa', pendingToken, code })
}

export function adminSetup2fa(password) {
  return postAdmin({ action: 'setup-2fa', password })
}

export function adminSetup2faVerify(password, secret, code) {
  return postAdmin({ action: 'setup-2fa-verify', password, secret, code })
}

export async function callAdminApi(action, params = {}) {
  const session = getStoredSession()
  return postAdmin({ action, ...params }, session?.token)
}
