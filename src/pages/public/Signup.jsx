import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { notify } from '../../lib/notify.js'

export default function Signup() {
  const [searchParams] = useSearchParams()
  const initialType = searchParams.get('type') === 'employer' ? 'employer' : searchParams.get('type') === 'candidate' ? 'candidate' : null

  const [userType, setUserType] = useState(initialType)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const { signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signUp({ email, password, userType })
      notify('signup-welcome', { userId: data.user.id })
      if (!data.session) {
        // Email confirmation is required before a session exists — there's
        // nothing to route into yet, so tell the candidate to check their inbox.
        setNeedsConfirmation(true)
        return
      }
      navigate(userType === 'employer' ? '/employer/onboarding' : '/profile/edit')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (needsConfirmation) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Check your inbox</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
          account, then log in to continue.
        </p>
        <Link to={`/login?type=${userType}`} className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
          Go to login
        </Link>
      </div>
    )
  }

  if (!userType) {
    return (
      <div className="section" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32 }}>Join Mellow</h1>
        <p style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>Are you looking for a role, or hiring?</p>
        <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
          <button className="btn btn-primary" style={{ flex: 1, padding: '16px 20px' }} onClick={() => setUserType('candidate')}>
            I'm looking for a role
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, padding: '16px 20px' }} onClick={() => setUserType('employer')}>
            I'm hiring
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="section" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28 }}>
        Sign up as {userType === 'employer' ? 'an employer' : 'talent'}
      </h1>
      <button
        type="button"
        onClick={() => setUserType(null)}
        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, padding: 0, marginTop: 6, cursor: 'pointer' }}
      >
        Change account type
      </button>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
        Already have an account?{' '}
        <Link to={`/login?type=${userType}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </div>
  )
}
