// In-memory cache for page data, scoped to the current SPA session (resets
// on a hard page reload). Lets a page render instantly from the last-known
// data when a user navigates back to it, while a fresh fetch runs in the
// background to bring it up to date. Shared by every page that opts into
// this pattern (dashboards, talent feed, roles, team, messages, etc.) — keys
// are namespaced per page (e.g. `employer:${userId}`, `talent:${userId}`) so
// unrelated pages never collide.
const cache = new Map()

export function getCachedDashboard(key) {
  return cache.get(key) || null
}

export function setCachedDashboard(key, data) {
  cache.set(key, data)
}

// Generic aliases — identical behavior, less dashboard-specific naming for
// use on non-dashboard pages.
export const getCachedPage = getCachedDashboard
export const setCachedPage = setCachedDashboard
