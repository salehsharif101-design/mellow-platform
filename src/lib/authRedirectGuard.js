// AuthContext listens for onAuthStateChange globally and redirects this tab
// whenever the session changes — that's exactly what lets a second tab pick
// up a login/logout that happened elsewhere without a manual refresh. But
// several flows deliberately drive their own session-change navigation in
// the SAME tab (Login.jsx's plain sign-in, its email-confirmation-link
// handling, Signup.jsx, TeamAccept.jsx, deleteAccount.js) — each with its
// own destination logic (wrong-portal-type checks, onboarding vs.
// dashboard, etc). Without a way to opt out, AuthContext's generic redirect
// would fire for those too and race with the more specific one.
//
// Call suppressNextAuthRedirect() immediately before intentionally changing
// this tab's own session; AuthContext consumes (and clears) it the next
// time onAuthStateChange fires, skipping its own redirect exactly once.
let suppressed = false
let clearTimer = null

export function suppressNextAuthRedirect() {
  suppressed = true
  clearTimeout(clearTimer)
  // Failsafe: a signIn/signOut/signUp fires its SIGNED_IN/SIGNED_OUT
  // notification well within this window in the normal case. If it never
  // fires at all (e.g. a failed signIn that threw before touching the
  // session), this stops the flag from silently swallowing some later,
  // unrelated cross-tab notification.
  clearTimer = setTimeout(() => {
    suppressed = false
  }, 2000)
}

export function consumeAuthRedirectSuppression() {
  if (!suppressed) return false
  suppressed = false
  clearTimeout(clearTimer)
  return true
}
