import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

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

  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!confirmedParam) return
    setShowConfirmed(true)
    const timer = setTimeout(() => setShowConfirmed(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmedParam])

  useEffect(() => {
    if (!confirmedParam) return
    // The confirmation link signs the user in automatically — if that
    // session is already here, skip the manual login and drop them
    // straight into onboarding. Anything short of a confirmed session +
    // known account type falls back to the login form below.
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const confirmedSession = data.session
        if (!confirmedSession) return
        const { data: row } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', confirmedSession.user.id)
          .single()
        if (cancelled || !row?.user_type) return
        navigate(row.user_type === 'employer' ? '/employer/onboarding' : '/profile/edit', { replace: true })
      } finally {
        if (!cancelled) setCheckingConfirmation(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [confirmedParam, navigate])

  if (checkingConfirmation) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await signIn({ email, password })
      const { data: row } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .single()

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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section" style={{ maxWidth: 420, margin: '0 auto' }}>
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

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
        New to Mellow?{' '}
        <Link to={`/signup?type=${type}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </div>
  )
}
