import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://beta.joinmellow.xyz/reset-password',
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Check your email</h1>
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>Check your email for a reset link.</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="section" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28 }}>Reset your password</h1>
      <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 15 }}>
        Enter your email and we'll send you a link to reset your password.
      </p>
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
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
        <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Back to login
        </Link>
      </p>
    </div>
  )
}
