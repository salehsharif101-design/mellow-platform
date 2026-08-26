import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Shared by EditProfileForm.jsx and the onboarding Step4Links.jsx — kicks
// off Calendly's OAuth flow (api/calendly-connect.js returns the authorize
// URL; api/calendly-callback.js does the actual token exchange + webhook
// registration once Calendly redirects back) and shows connect/connected
// state either way.
export default function CalendlyConnect({ connected, username, onDisconnected }) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/calendly-connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not start the Calendly connection.')
      window.location.href = body.authorizeUrl
    } catch (err) {
      setError(err.message)
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/calendly-disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not disconnect Calendly.')
      onDisconnected()
    } catch (err) {
      setError(err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (connected) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="tag" style={{ background: '#e3f9e9', color: '#0f7a3d', fontWeight: 600 }}>
            ✓ Calendly connected{username ? ` as ${username}` : ''}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect Calendly'}
          </button>
        </div>
        {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleConnect}
        disabled={connecting}
        style={{ fontSize: 13, padding: '9px 18px' }}
      >
        {connecting ? 'Connecting…' : 'Connect Calendly'}
      </button>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
