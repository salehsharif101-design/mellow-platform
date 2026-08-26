import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useHideChrome } from '../../components/Layout.jsx'

// Reached from the second employer follow-up email's "Not this time"
// button (api/cron/meeting-follow-up.js's sendSecondFollowUps). Recording
// the outcome happens server-side in api/meeting-outcome.js's
// "not_this_time" action, this page just fires that request and shows the
// moment — no further follow-up emails go out after this.
export default function NotThisTime() {
  const [searchParams] = useSearchParams()
  const candidateId = searchParams.get('candidate')
  const employerId = searchParams.get('employer')
  useHideChrome()

  useEffect(() => {
    if (!candidateId || !employerId) return
    fetch('/api/meeting-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'not_this_time', candidateId, employerId }),
    }).catch(() => {})
  }, [candidateId, employerId])

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <img src="/Flexible.PNG" alt="" style={{ width: '100%', maxWidth: 240, margin: '0 auto', display: 'block' }} />
        <h1 style={{ marginTop: 28, fontSize: 'clamp(26px, 3.6vw, 34px)' }}>Thanks for letting us know.</h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Keep browsing talent on Mellow, your next great hire might be one video away.
        </p>
        <Link to="/employer/talent" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-block' }}>
          Browse talent
        </Link>
      </div>
    </div>
  )
}
