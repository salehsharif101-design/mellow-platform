import { useEffect, useRef, useState } from 'react'

const COOLDOWN_SECONDS = 60

// Resend-with-cooldown control for the "check your inbox" screens (signup
// confirmation, team invite acceptance). After a successful resend the
// button is replaced by a countdown for COOLDOWN_SECONDS, then reappears
// so they can send it again — there's no cap on how many times, just a
// pace-limiter so the button can't be mashed.
export default function ResendConfirmationButton({ onResend, onSuccess, disabled = false, label = 'Resend confirmation email' }) {
  const [resending, setResending] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function startCountdown() {
    setSecondsLeft(COOLDOWN_SECONDS)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleClick() {
    setError('')
    setResending(true)
    try {
      await onResend()
      startCountdown()
      onSuccess?.()
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
    <div style={{ marginTop: 16 }}>
      {error && (
        <p className="form-error" style={{ marginBottom: 8 }}>
          {error}
        </p>
      )}
      {secondsLeft > 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}>Resend again in {secondsLeft}s</p>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={handleClick} disabled={resending || disabled}>
          {resending ? 'Sending…' : label}
        </button>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
        Check your spam folder if you do not see it in your inbox.
      </p>
    </div>
  )
}
