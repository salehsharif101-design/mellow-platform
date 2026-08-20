import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

const PASSWORD_REQUIREMENT_MESSAGE = 'Password must be at least 8 characters and include a number or special character'

function isStrongPassword(password) {
  return password.length >= 8 && /[0-9\W]/.test(password)
}

export default function TeamAccept() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { session, signUp, resendConfirmation } = useAuth()
  const navigate = useNavigate()

  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('This invitation link is missing a token.')
      setLoading(false)
      return
    }

    async function lookup() {
      try {
        const res = await fetch('/api/team-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lookup', token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'This invitation link is invalid.')
        setInvite(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    lookup()
  }, [token])

  // If they're already signed in (e.g. they logged into an existing
  // account, then came back to this same link) and the email matches,
  // accept automatically instead of asking them to set a new password.
  useEffect(() => {
    if (!session || !invite || invite.status === 'active' || accepted) return
    if ((session.user.email || '').toLowerCase() !== invite.invitedEmail.toLowerCase()) return

    async function autoAccept() {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ action: 'accept', token }),
      })
      if (res.ok) {
        setAccepted(true)
        navigate('/employer/dashboard')
      }
    }

    autoAccept()
  }, [session, invite, accepted, token, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!isStrongPassword(password)) {
      setError(PASSWORD_REQUIREMENT_MESSAGE)
      return
    }

    setSubmitting(true)
    try {
      // If email confirmation is required, Supabase emails a link back to
      // this exact page (not the generic /login one) — otherwise the
      // confirmation flow has no idea this signup was accepting a team
      // invite and sends them into onboarding as if they were starting a
      // brand new company.
      const data = await signUp({
        email: invite.invitedEmail,
        password,
        userType: 'employer',
        emailRedirectTo: `https://beta.joinmellow.xyz/employer/team/accept?token=${token}`,
      })
      if (!data.session) {
        setNeedsConfirmation(true)
        setSubmitting(false)
        return
      }
      const res = await fetch('/api/team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ action: 'accept', token }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Something went wrong accepting the invitation.')
      // Not resetting submitting here — navigating away, so this component
      // is about to unmount.
      navigate('/employer/dashboard')
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError('')
    setResending(true)
    try {
      await resendConfirmation(invite.invitedEmail, `https://beta.joinmellow.xyz/employer/team/accept?token=${token}`)
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

  if (loading) return null

  // Already signed in with a matching, not-yet-active session — the effect
  // above is about to accept and redirect. Render nothing rather than the
  // full "set a password" form for the instant before that finishes.
  const willAutoAccept =
    session &&
    invite &&
    invite.status !== 'active' &&
    !accepted &&
    (session.user.email || '').toLowerCase() === invite.invitedEmail.toLowerCase()
  if (willAutoAccept) return null

  if (error && !invite) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>Invitation not found</h1>
        <p className="form-error" style={{ marginTop: 12 }}>{error}</p>
      </div>
    )
  }

  if (invite?.status === 'active') {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>This invitation has already been accepted</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          Log in to access {invite.companyName}'s dashboard.
        </p>
        <Link to="/login?type=employer" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
          Go to login
        </Link>
      </div>
    )
  }

  if (needsConfirmation) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>Check your inbox</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          We sent a confirmation link to <strong>{invite.invitedEmail}</strong>. Click it, then come back to this
          same invitation link to finish joining {invite.companyName}.
        </p>
        {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}
        {resendSent ? (
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
            Email resent — check your inbox.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleResend}
            disabled={resending}
            style={{ marginTop: 16 }}
          >
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="section" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28 }}>Join {invite?.companyName} on Mellow</h1>
      <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 15 }}>
        Set a password to accept the invitation and access the team's dashboard.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={invite?.invitedEmail || ''} disabled />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            At least 8 characters, including a number or special character.
          </p>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Joining…' : 'Accept invitation'}
        </button>
      </form>
    </div>
  )
}
