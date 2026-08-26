import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHideChrome } from '../../components/Layout.jsx'
import Confetti from '../../components/Confetti.jsx'

// Reached from the employer follow-up email's "Yes, we made a hire" button
// (api/cron/meeting-follow-up.js). Recording the outcome and emailing the
// candidate to confirm both happen server-side in api/meeting-outcome.js —
// this page just fires that request and shows the moment.
export default function HireConfirmed() {
  const [searchParams] = useSearchParams()
  const candidateId = searchParams.get('candidate')
  const employerId = searchParams.get('employer')
  useHideChrome()

  useEffect(() => {
    if (!candidateId || !employerId) return
    fetch('/api/meeting-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hire_confirmed', candidateId, employerId }),
    }).catch(() => {})
  }, [candidateId, employerId])

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <Confetti />
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)' }}>Congratulations.</h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Thank you for hiring through Mellow.
        </p>
      </div>
    </div>
  )
}
