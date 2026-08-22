import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { suppressNextAuthRedirect, consumeAuthRedirectSuppression } from '../lib/authRedirectGuard.js'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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
      setSession(data.session)
      setLoading(false)
    })

    // Supabase syncs the session across same-origin tabs via localStorage,
    // and re-fires onAuthStateChange here when that happens — so this one
    // listener is what lets a second tab pick up a login or logout from
    // another tab without a manual refresh. Flows that drive their own
    // navigation for a session change in THIS tab (Login.jsx, Signup.jsx,
    // TeamAccept.jsx, deleteAccount.js) call suppressNextAuthRedirect()
    // first so they don't race with the generic redirect below.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return
      if (consumeAuthRedirectSuppression()) return

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
    if (!session?.user) {
      setProfile(null)
      return
    }
    supabase
      .from('users')
      .select('id, email, user_type')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null))
  }, [session?.user])

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
