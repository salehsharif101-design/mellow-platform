import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useHideChrome } from '../../components/Layout.jsx'

// Shared by two routes that land on the same message per the spec:
// /still-deciding (employer, from the meeting follow-up email) and
// /hire-declined (candidate, from the hire-confirmation email), which
// action gets recorded is picked from the current path rather than
// needing two near-identical page components.
export default function ThanksForLettingUsKnow() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const candidateId = searchParams.get('candidate') || searchParams.get('candidateId')
  const employerId = searchParams.get('employer')
  useHideChrome()

  useEffect(() => {
    if (!candidateId || !employerId) return
    const action = pathname === '/hire-declined' ? 'hire_declined' : 'still_deciding'
    fetch('/api/meeting-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, candidateId, employerId }),
    }).catch(() => {})
    // Only ever needs to fire once per landing, regardless of later
    // navigation state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <img src="/Flexible.PNG" alt="" style={{ width: '100%', maxWidth: 240, margin: '0 auto', display: 'block' }} />
        <h1 style={{ marginTop: 28, fontSize: 'clamp(26px, 3.6vw, 34px)' }}>Thanks for letting us know.</h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Good luck, we are rooting for you.
        </p>
      </div>
    </div>
  )
}
