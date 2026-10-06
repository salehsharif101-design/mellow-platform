import { useState } from 'react'
import { adminSetup2fa, adminSetup2faVerify } from './adminApi.js'

// One-time enrollment for the admin panel's TOTP two-factor. The server
// (api/admin.js's 'setup-2fa') refuses to hand out a secret once
// ADMIN_TOTP_SECRET exists, so after setup this page can only ever show the
// "already set up" message — the real enforcement lives there, not here.
export default function Setup2FA() {
  const [password, setPassword] = useState('')
  const [setup, setSetup] = useState(null)
  const [error, setError] = useState('')
  const [alreadySetUp, setAlreadySetUp] = useState(false)
  const [loading, setLoading] = useState(false)

  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleStart(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      setSetup(await adminSetup2fa(password))
    } catch (err) {
      if (err.status === 403) setAlreadySetUp(true)
      else setError(err.status === 401 ? 'Incorrect password.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setVerifying(true)
    setError('')
    try {
      await adminSetup2faVerify(password, setup.secret, code)
      setVerified(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setVerifying(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`ADMIN_TOTP_SECRET=${setup.secret}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be unavailable (insecure context, permissions) — the
      // value is still on screen to select by hand.
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg)',
    padding: 20,
  }
  const cardStyle = { padding: 32, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 }

  if (alreadySetUp) {
    return (
      <div style={pageStyle}>
        <div className="card" style={cardStyle}>
          <h1 style={{ fontSize: 20 }}>Two-factor authentication is already set up</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            This page only works while ADMIN_TOTP_SECRET is not set. Nothing was changed.
          </p>
        </div>
      </div>
    )
  }

  if (!setup) {
    return (
      <div style={pageStyle}>
        <form onSubmit={handleStart} className="card" style={cardStyle}>
          <h1 style={{ fontSize: 20 }}>Set up two-factor authentication</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            Enter the admin password to generate a QR code for Google Authenticator, Authy, or any TOTP app.
          </p>
          <div className="field">
            <label htmlFor="setup-password">Password</label>
            <input
              id="setup-password"
              type="password"
              className="input"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Generate QR code'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: 20 }}>Set up two-factor authentication</h1>

        <div>
          <p style={{ fontSize: 14, fontWeight: 700 }}>1. Scan this QR code</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Open your authenticator app, add an account, and scan.
          </p>
          <img
            src={setup.qrDataUrl}
            alt="QR code for the admin two-factor secret"
            width={260}
            height={260}
            style={{ display: 'block', margin: '12px auto' }}
          />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Can't scan? Enter this key manually:</p>
          <code style={{ display: 'block', marginTop: 6, fontSize: 14, wordBreak: 'break-all', userSelect: 'all' }}>
            {setup.secret}
          </code>
        </div>

        <div>
          <p style={{ fontSize: 14, fontWeight: 700 }}>2. Confirm it works</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Enter the 6-digit code your app now shows. This only checks the code; nothing is turned on yet.
          </p>
          {verified ? (
            <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: '#0f7a3d' }}>Code matches. Your app is set up correctly.</p>
          ) : (
            <form onSubmit={handleVerify} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                style={{ letterSpacing: 4 }}
              />
              <button className="btn btn-primary" type="submit" disabled={verifying || code.length !== 6}>
                {verifying ? 'Checking…' : 'Check'}
              </button>
            </form>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>

        <div>
          <p style={{ fontSize: 14, fontWeight: 700 }}>3. Turn it on</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            In Vercel, add this environment variable (Settings, then Environment Variables) and redeploy. Two-factor
            starts the moment the new deployment is live.
          </p>
          <code style={{ display: 'block', marginTop: 8, fontSize: 13, wordBreak: 'break-all' }}>
            ADMIN_TOTP_SECRET={setup.secret}
          </code>
          <button type="button" className="btn btn-ghost" onClick={handleCopy} style={{ marginTop: 8 }}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Don't refresh or leave this page until you've saved the key — it's generated fresh each time and is not
          stored anywhere.
        </p>
      </div>
    </div>
  )
}
