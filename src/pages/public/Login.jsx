import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { useRedirectIfAuthenticated } from '../../lib/useRedirectIfAuthenticated.js'
import { useHideChrome } from '../../components/Layout.jsx'
import { suppressNextAuthRedirect } from '../../lib/authRedirectGuard.js'
import Logo from '../../components/Logo.jsx'
import ResendConfirmationButton from '../../components/ResendConfirmationButton.jsx'

export default function Login() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') === 'employer' ? 'employer' : 'candidate'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const resetSuccess = searchParams.get('reset') === 'success'
  const confirmedParam = searchParams.get('confirmed') === '1'
  const [showConfirmed, setShowConfirmed] = useState(false)
  const [checkingConfirmation, setCheckingConfirmation] = useState(confirmedParam)
  // The confirmation-link flow below has its own "already logged in" bounce
  // (it needs to send a just-confirmed employer to onboarding, not just the
  // dashboard) — skipped here so the two don't race each other.
  const checkingSession = useRedirectIfAuthenticated(confirmedParam)
  // The shared header shows the fully authenticated nav (dashboard, messages,
  // account menu) whenever AuthContext's session is truthy, with no idea it's
  // rendering on the login page — e.g. someone with an existing session in
  // this browser who lands here via an unrelated/expired confirmation link.
  // The login page should never show that nav, so chrome stays hidden for
  // this component's entire lifetime rather than just the confirmation-
  // checking window; Logo below replaces the header's own logo link.
  useHideChrome()
  const [needsResend, setNeedsResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const [resentFromExpiredLink, setResentFromExpiredLink] = useState(false)

  const { signIn, resendConfirmation } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!confirmedParam) return
    // A failed/expired/already-used confirmation link redirects here too,
    // with the failure encoded in the URL hash rather than a query param —
    // Supabase doesn't fail closed to an error page, it lands back on our
    // redirect target either way. Without checking for this, that failure
    // was previously silent: the user just saw a plain login form with no
    // indication their email was never actually confirmed.
    if (window.location.hash.includes('error')) {
      setInvalidLink(true)
      setCheckingConfirmation(false)
      return
    }
    setShowConfirmed(true)
    const timer = setTimeout(() => setShowConfirmed(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmedParam])

  useEffect(() => {
    if (!confirmedParam || invalidLink) return
    // The confirmation link signs the user in automatically — if that
    // session is already here, skip the manual login and drop them
    // straight into onboarding (or, for a team member accepting an
    // invite, straight to their company's dashboard — they're joining an
    // existing company, not starting one). Anything short of a confirmed
    // session + known account type falls back to the login form below.
    // This establishes the session directly from the URL hash rather than
    // through AuthContext's signIn(), so its generic redirect needs its own
    // opt-out here too, or it would race this effect's onboarding-aware one.
    suppressNextAuthRedirect()
    let cancelled = false
    // getSession() and the SIGNED_IN listener below can both resolve with
    // the same session — this guards against routing twice.
    let routed = false

    async function routeToDestination(confirmedSession) {
      if (routed) return
      routed = true
      const { data: row } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', confirmedSession.user.id)
        .single()
      if (cancelled) return
      if (!row?.user_type) {
        setCheckingConfirmation(false)
        return
      }

      let destination = '/profile/edit'
      if (row.user_type === 'employer') {
        const { employerId, isOwner } = await resolveEmployerId(confirmedSession.user.id)
        if (cancelled) return
        destination = employerId && !isOwner ? '/employer/dashboard' : '/employer/onboarding'
      }
      // Deliberately not resetting checkingConfirmation here — this
      // component is about to unmount as the route changes, and flipping
      // it to false first would render the full login form for one frame
      // before that navigation actually takes effect.
      navigate(destination, { replace: true })
    }

    // The confirmation link's session tokens arrive in the URL hash and are
    // exchanged for a session asynchronously as the Supabase client
    // initializes — getSession() below already waits for that, but as a
    // backstop against any timing gap, also listen for the SIGNED_IN event
    // it fires once the session is actually saved, so a token still being
    // processed never falls through to showing the login form.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || event !== 'SIGNED_IN' || !session) return
      routeToDestination(session)
    })

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        routeToDestination(data.session)
        return
      }
      // Only give up and show the login form once it's clear there's
      // nothing left to wait for — a token still sitting in the hash means
      // the SIGNED_IN listener above will fire shortly.
      if (!window.location.hash.includes('access_token')) {
        setCheckingConfirmation(false)
      }
    })()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [confirmedParam, invalidLink, navigate])

  if (checkingConfirmation || checkingSession) return null

  if (invalidLink) {
    if (resentFromExpiredLink) {
      return (
        <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: 32 }}>
            <Logo size={28} />
          </Link>
          <h1 style={{ fontSize: 28 }}>Check your inbox</h1>
          <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then log in
            to continue.
          </p>
          <ResendConfirmationButton onResend={() => resendConfirmation(email)} />
        </div>
      )
    }
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <Link to="/" style={{ display: 'inline-block', marginBottom: 32 }}>
          <Logo size={28} />
        </Link>
        <h1 style={{ fontSize: 28 }}>Confirmation link expired</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          This confirmation link has expired or already been used. Enter your email to resend a new one.
        </p>
        <div className="field" style={{ marginTop: 24, textAlign: 'left' }}>
          <label htmlFor="resend-email">Email</label>
          <input
            id="resend-email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ textAlign: 'left' }}>
          <ResendConfirmationButton
            onResend={() => resendConfirmation(email)}
            onSuccess={() => setResentFromExpiredLink(true)}
            disabled={!email}
          />
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNeedsResend(false)
    setResendSent(false)
    setLoading(true)
    try {
      // Checked before attempting to sign in at all — a removed team
      // member's Supabase Auth account is normally deleted outright (see
      // api/team-remove.js), so signIn() would just fail with a generic
      // "Invalid login credentials" with no way to tell them why. This
      // check is keyed off email rather than a user id for exactly that
      // reason: it has to work even after the account itself is gone.
      const removedRes = await fetch('/api/check-removed-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const removedData = await removedRes.json().catch(() => ({}))
      if (removedRes.ok && removedData.removed) {
        setError('Your team access has been removed. Please sign up for a new account if you would like to use Mellow.')
        return
      }

      const { user } = await signIn({ email, password })

      const [{ data: row }, { data: removedMembership }] = await Promise.all([
        supabase.from('users').select('user_type').eq('id', user.id).single(),
        supabase.from('employer_team_members').select('id').eq('user_id', user.id).eq('status', 'removed').maybeSingle(),
      ])

      if (removedMembership) {
        // Their team access was revoked, but the auth-account deletion that
        // normally accompanies a removal didn't go through — this row is the
        // fallback marker for that case (see api/team-remove.js). Don't let
        // them back into the dashboard with stale access.
        await supabase.auth.signOut()
        setError('Your team access has been removed. Please sign up for a new account if you would like to use Mellow.')
        return
      }

      if (row?.user_type && row.user_type !== type) {
        // Wrong login page for this account — don't leave them signed in
        // here, send them to the login page that actually matches.
        await supabase.auth.signOut()
        setError(
          row.user_type === 'employer'
            ? 'This account is registered as an employer. Please sign in at the employer login page.'
            : 'This account is registered as a talent. Please sign in at the talent login page.',
        )
        setTimeout(() => navigate(`/login?type=${row.user_type}`), 2500)
        return
      }

      navigate(row?.user_type === 'employer' ? '/employer/dashboard' : '/dashboard')
    } catch (err) {
      setError(err.message)
      // Supabase's message for this case is literally "Email not confirmed" —
      // previously this was a dead end: no resend option existed anywhere,
      // and re-signing up with the same email just says "already registered,
      // sign in instead," which loops right back here.
      if (err.message === 'Email not confirmed') setNeedsResend(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setResending(true)
    try {
      await resendConfirmation(email)
      setResendSent(true)
    } catch (err) {
      // supabase-js's AuthRetryableFetchError (thrown for 5xx responses,
      // e.g. when Supabase's own mailer is down or rate-limited) surfaces
      // the raw response body as .message instead of anything readable —
      // "{}" is a common case. Fall back to a plain message rather than
      // showing that.
      setError(/^\s*\{.*\}\s*$/.test(err.message) ? 'Could not send the email right now. Please try again in a moment.' : err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="section" style={{ maxWidth: 420, margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: 24 }}>
        <Logo size={28} />
      </Link>
      <h1 style={{ fontSize: 28 }}>
        Sign in as {type === 'employer' ? 'an employer' : 'talent'}
      </h1>
      {resetSuccess && (
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
          Your password has been reset. Log in with your new password.
        </p>
      )}
      {showConfirmed && (
        <p
          style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--color-bg-soft)',
            fontSize: 14,
            color: 'var(--color-primary)',
            fontWeight: 600,
            transition: 'opacity 0.3s ease',
          }}
        >
          Your email is confirmed. Sign in to get started.
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link to="/forgot-password" style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
            Forgot password?
          </Link>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {resendSent ? (
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
          Confirmation email sent — check your inbox.
        </p>
      ) : (
        needsResend && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleResend}
            disabled={resending || !email}
            style={{ marginTop: 16 }}
          >
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>
        )
      )}

      <Link
        to={`/login?type=${type === 'employer' ? 'candidate' : 'employer'}`}
        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, padding: 0, marginTop: 6, cursor: 'pointer', display: 'inline-block', textDecoration: 'none' }}
      >
        {type === 'employer' ? 'Want to sign in as a talent?' : 'Want to sign in as an employer?'}
      </Link>

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
        New to Mellow?{' '}
        <Link to={`/signup?type=${type}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </div>
  )
}
