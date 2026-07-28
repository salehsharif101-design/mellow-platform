const SESSION_KEY = 'mellow_admin_pw'

export function getStoredPassword() {
  return sessionStorage.getItem(SESSION_KEY)
}

export function storePassword(password) {
  sessionStorage.setItem(SESSION_KEY, password)
}

export function clearStoredPassword() {
  sessionStorage.removeItem(SESSION_KEY)
}

export async function callAdminApi(action, params = {}) {
  const password = getStoredPassword()
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, action, ...params }),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}
