import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// Shared "Connect your Calendly" / connected-state UI — used by both
// EditProfileForm.jsx (a fully onboarded candidate) and the onboarding
// wizard's Step4Links.jsx (returnTo="onboarding" instead of "edit", so
// api/calendly-oauth/callback.js lands the candidate back on the wizard
// step they were on, rather than the separate Edit Profile page).
//
// Connecting always navigates the whole page away to Calendly and back, so
// there's no in-place "connected" state to manage here — the component
// that mounts next reads the fresh scheduling_url straight from the
// candidate_profiles row. Disconnecting doesn't reload the page, so it
// tracks that one transition locally (disconnectedLocally) rather than
// depending on a parent to thread updated profile state back down.
export default function CalendlyConnect({ schedulingUrl, username, returnTo, onDisconnected }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectedLocally, setDisconnectedLocally] = useState(false)
  const [error, setError] = useState('')
  const [statusBanner, setStatusBanner] = useState(null)

  // Reflects the ?calendly=connected|denied|error param api/calendly-oauth/
  // callback.js redirects back with, then strips it from the url so
  // refreshing the page doesn't keep re-showing the same banner.
  useEffect(() => {
    const calendlyStatus = searchParams.get('calendly')
    if (!calendlyStatus) return
    if (calendlyStatus === 'connected') setStatusBanner({ type: 'success', message: 'Calendly connected.' })
    else if (calendlyStatus === 'denied') setStatusBanner({ type: 'error', message: 'Calendly connection was cancelled.' })
    else setStatusBanner({ type: 'error', message: 'Something went wrong connecting Calendly. Please try again.' })
    const next = new URLSearchParams(searchParams)
    next.delete('calendly')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connected = !disconnectedLocally && Boolean(schedulingUrl)

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch(`/api/calendly-oauth?returnTo=${returnTo}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to start Calendly connection.')
      window.location.href = data.url
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect Calendly.')
      setDisconnectedLocally(true)
      onDisconnected?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div id="calendly-section">
      {statusBanner && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
            color: statusBanner.type === 'success' ? '#0f7a3d' : '#b42318',
          }}
        >
          {statusBanner.message}
        </p>
      )}
      {error && (
        <p className="form-error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      {connected ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 10,
            background: '#eefaf1',
            border: '1px solid #b9e6c4',
            maxWidth: 420,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0f7a3d', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: '#0f7a3d', fontWeight: 600, flex: 1 }}>
            Connected{username ? ` as @${username}` : ''}
          </span>
          <button type="button" className="btn btn-ghost" disabled={disconnecting} onClick={handleDisconnect}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" disabled={connecting} onClick={handleConnect}>
          {connecting ? 'Connecting…' : 'Connect your Calendly'}
        </button>
      )}
    </div>
  )
}
