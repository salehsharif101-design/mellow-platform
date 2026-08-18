// In-memory cache for dashboard data, scoped to the current SPA session
// (resets on a hard page reload). Lets a dashboard render instantly from
// the last-known data when a user navigates back to it, while a fresh
// fetch runs in the background to bring it up to date.
const cache = new Map()

export function getCachedDashboard(key) {
  return cache.get(key) || null
}

export function setCachedDashboard(key, data) {
  cache.set(key, data)
}
