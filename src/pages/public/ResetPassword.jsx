import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, previousSession } from '../../lib/supabase.js'
import { useHideChrome } from '../../components/Layout.jsx'
import WrongAccountNotice from '../../components/WrongAccountNotice.jsx'

export default function ResetPassword() {
  const navigate = useNavigate()
  // This page only ever makes sense mid-recovery-link — the shared header's
  // nav (built around whatever account happens to be signed in) has nothing
  // useful to show here, and would otherwise contradict the wrong-account
  // notice below about which account is actually active.
  useHideChrome()

  const [ready, setReady] = useState(false)
  const [linkInvalid, setLinkInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [wrongAccountEmail, setWrongAccountEmail] = useState(null)
  // Guards handleRecoverySession against running twice — React StrictMode's
  // dev-mode double-invoke of this effect creates two separate closures,
  // each with the onAuthStateChange listener AND the getSession() fallback
  // able to call it, and a plain `let` inside the effect only dedupes
  // within ONE of those two invocations. A ref is shared across both, since
  // it belongs to the component instance rather than either effect run.
  const handledRef = useRef(false)

  useEffect(() => {
    function handleRecoverySession(recoverySession) {
      if (handledRef.current || !recoverySession) return
      handledRef.current = true

      if (
        previousSession?.user?.email &&
        recoverySession.user?.email &&
        previousSession.user.email.toLowerCase() !== recoverySession.user.email.toLowerCase()
      ) {
        // A different account was already signed in on this device before
        // this recovery link's own session took over — but that session
        // (the recovery link's) is the correct, valid one to actually use
        // here, so it's left alone rather than signed out: signOut()
        // invalidates whatever session it's called on server-side
        // regardless of scope, and doing that now would destroy the very
        // session needed to finish the reset, with the link's one-time
        // token already spent and no way to get it back short of a new
        // email. previousSession.user.email (captured before any of this)
        // is what actually needs to be shown here, not the live session.
        setWrongAccountEmail(previousSession.user.email)
        return
      }

      setReady(true)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') handleRecoverySession(session)
    })

    // Covers the case where the recovery session was already parsed from the
    // URL by the time this effect runs (the event can fire before we subscribe).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) handleRecoverySession(data.session)
    })

    const timeout = setTimeout(() => {
      // handledRef (not the `ready` state) is the right check here — a
      // wrong-account link was successfully handled too, just routed to a
      // different screen than the "set a new password" form this timeout
      // exists to fall back from.
      if (!handledRef.current) setLinkInvalid(true)
    }, 4000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  function handleContinueFromWrongAccount() {
    setWrongAccountEmail(null)
    setReady(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      // Not resetting saving here — navigating away, so this component is
      // about to unmount.
      navigate('/login?reset=success')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (wrongAccountEmail) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <WrongAccountNotice currentEmail={wrongAccountEmail} skipSignOut onSignOut={handleContinueFromWrongAccount} />
      </div>
    )
  }

  if (linkInvalid) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Link expired</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          This password reset link is invalid or has expired. Request a new one from the login page.
        </p>
      </div>
    )
  }

  if (!ready) return null

  return (
    <div className="section" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28 }}>Set a new password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm_password">Confirm new password</label>
          <input
            id="confirm_password"
            className="input"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </div>
  )
}
