import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [ready, setReady] = useState(false)
  const [linkInvalid, setLinkInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // Covers the case where the recovery session was already parsed from the
    // URL by the time this effect runs (the event can fire before we subscribe).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) setLinkInvalid(true)
        return current
      })
    }, 4000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

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
      navigate('/login?reset=success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
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
