import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { suppressNextAuthRedirect, consumeAuthRedirectSuppression } from '../lib/authRedirectGuard.js'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // `loading` only covers the session itself resolving — profile (and so
  // userType) resolves afterward, in its own effect below. Without this
  // tracked separately, anything gating on userType (ProtectedRoute, the
  // nav) has no way to tell "not signed in as that type" apart from
  // "haven't found out yet" during that gap, and would treat the two the
  // same — which is exactly what let a cold-loading employer briefly see
  // the candidate nav, or fall through a route guard into the wrong
  // dashboard.
  const [profileLoading, setProfileLoading] = useState(true)
  const navigate = useNavigate()
  // Tracks the signed-in user id outside React state so the listener below
  // can tell a genuine cross-tab identity change (someone logged in or out
  // in another tab) apart from GoTrue re-emitting SIGNED_IN for the SAME
  // user — which it does on things like the tab regaining focus/visibility,
  // not just on an actual login. Without this, clicking an external link
  // (LinkedIn, a Calendly booking) that opens in a new tab and coming back
  // fires a spurious SIGNED_IN here and yanks the user off the page they
  // were already on and into the dashboard.
  const currentUserIdRef = useRef(null)
  // GoTrue's own startup flow re-emits a genuine SIGNED_IN (not just
  // INITIAL_SESSION) for an already-valid session restored from storage on
  // every hard page load — not only on an actual new login — and it can
  // fire before this component's own getSession() call below has had a
  // chance to set currentUserIdRef. When that happens, previousUserId is
  // still this ref's initial null, so an ordinary already-logged-in page
  // load (e.g. clicking a link straight from an email, or any other fresh
  // navigation to a protected route) reads as "a different user just
  // signed in" and gets redirected to the generic dashboard, overriding
  // wherever the URL actually pointed. Ignoring every SIGNED_IN/SIGNED_OUT
  // until the initial getSession() below has resolved at least once closes
  // that window — a genuine subsequent auth change (a real login, a
  // cross-tab logout) always arrives well after that first resolution.
  const initialSessionResolvedRef = useRef(false)

  useEffect(() => {
    // A URL hash carrying auth tokens means this page load landed here
    // straight from an email link (signup confirmation, team invite,
    // password recovery) — whichever page this is almost certainly has its
    // own destination logic for the session that hash is about to
    // establish (see Login.jsx's confirmedParam flow, TeamAccept.jsx's
    // auto-accept), so the generic redirect below shouldn't race it.
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      suppressNextAuthRedirect()
    }

    supabase.auth.getSession().then(({ data }) => {
      currentUserIdRef.current = data.session?.user?.id ?? null
      setSession(data.session)
      setLoading(false)
      initialSessionResolvedRef.current = true
    })

    // Supabase syncs the session across same-origin tabs via localStorage,
    // and re-fires onAuthStateChange here when that happens — so this one
    // listener is what lets a second tab pick up a login or logout from
    // another tab without a manual refresh. Flows that drive their own
    // navigation for a session change in THIS tab (Login.jsx, Signup.jsx,
    // TeamAccept.jsx, deleteAccount.js) call suppressNextAuthRedirect()
    // first so they don't race with the generic redirect below.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      const previousUserId = currentUserIdRef.current
      currentUserIdRef.current = newSession?.user?.id ?? null
      setSession(newSession)

      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return
      if (consumeAuthRedirectSuppression()) return
      if (!initialSessionResolvedRef.current) return

      // Redirect only on an actual identity change — a different (or newly
      // present/absent) user id than this tab already had. A same-user
      // SIGNED_IN re-fire (e.g. from a focus/visibility revalidation after
      // switching back from an externally opened tab) leaves the id
      // unchanged, so it's ignored here and the current page is left alone.
      if (newSession?.user?.id === previousUserId) return

      if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true })
        return
      }

      // SIGNED_IN
      supabase
        .from('users')
        .select('user_type')
        .eq('id', newSession.user.id)
        .single()
        .then(({ data: row }) => {
          navigate(row?.user_type === 'employer' ? '/employer/dashboard' : '/dashboard', { replace: true })
        })
    })

    return () => listener.subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    // Wait for the session itself to resolve first. Otherwise, on initial
    // mount `session` is still null (not yet determined, indistinguishable
    // from "confirmed logged out"), this branch sets profileLoading false,
    // and that stale false lingers into the render right after getSession()
    // comes back with a real session but before this effect has re-run to
    // flip profileLoading back to true — a window where ProtectedRoute sees
    // a session with profileLoading false and userType still null, reads it
    // as "wrong type," and bounces a logged-in candidate off the page they
    // asked for (e.g. /applications, /roles) to "/".
    if (loading) return
    if (!session?.user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    supabase
      .from('users')
      .select('id, email, user_type')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfile(data ?? null)
        setProfileLoading(false)
      })
  }, [session?.user, loading])

  async function signUp({ email, password, userType, emailRedirectTo }) {
    // If this signUp establishes a session immediately (email confirmation
    // disabled), the caller (Signup.jsx, TeamAccept.jsx) navigates itself
    // right after — skip the generic redirect above so it doesn't race.
    suppressNextAuthRedirect()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { user_type: userType },
        emailRedirectTo: emailRedirectTo || 'https://beta.joinmellow.xyz/login?confirmed=1',
      },
    })
    if (error) throw error
    return data
  }

  async function signIn({ email, password }) {
    // The caller (Login.jsx) navigates itself after checking things the
    // generic redirect doesn't know about (wrong-portal-type, removed team
    // member) - skip it here so it doesn't race with that.
    suppressNextAuthRedirect()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function resendConfirmation(email, emailRedirectTo) {
    // Supabase's own resend() returns a clean, error-free success for an
    // already-confirmed account without actually sending anything — same
    // anti-enumeration silence as signUp() (see api/check-email.js) — so
    // callers (ResendConfirmationButton.jsx) had no way to tell that apart
    // from a genuine send: the button showed its normal countdown while
    // nothing ever arrived. Checked here first so an already-confirmed
    // account gets a real, honest message instead. Best-effort: a failure
    // of this check itself (network, 500) falls through to the normal
    // resend attempt rather than blocking the whole flow on it.
    try {
      const res = await fetch('/api/check-email-confirmed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.confirmed) {
        throw new Error('This email is already confirmed. You can log in now.')
      }
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch itself failed (offline, DNS, etc.) — fall through to the
        // normal resend attempt rather than blocking on this check.
      } else {
        throw err
      }
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: emailRedirectTo || 'https://beta.joinmellow.xyz/login?confirmed=1' },
    })
    if (error) throw error
  }

  async function signOut() {
    // Most callers navigate somewhere specific right after (or are already
    // on a public page) — skip the generic /login redirect so it doesn't
    // race with that.
    suppressNextAuthRedirect()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    userType: profile?.user_type ?? null,
    loading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
