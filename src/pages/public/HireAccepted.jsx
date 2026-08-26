import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHideChrome } from '../../components/Layout.jsx'
import Confetti from '../../components/Confetti.jsx'

const REFERRAL_MESSAGE =
  'I just got hired through Mellow — a video-first hiring platform where you apply with a 60-second video instead of a CV. Check it out 👉 https://beta.joinmellow.xyz'

// Reached from the hire-confirmation email's "Yes, I got the role" button
// (sent by api/meeting-outcome.js's "hire_confirmed" action). Recording the
// hire and turning off the candidate's availability/visibility both happen
// server-side in api/meeting-outcome.js — this page just fires that
// request and shows the celebration.
export default function HireAccepted() {
  const [searchParams] = useSearchParams()
  const candidateId = searchParams.get('candidateId') || searchParams.get('candidate')
  const employerId = searchParams.get('employer')
  useHideChrome()

  useEffect(() => {
    if (!candidateId || !employerId) return
    fetch('/api/meeting-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hire_accepted', candidateId, employerId }),
    }).catch(() => {})
  }, [candidateId, employerId])

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <Confetti />
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)' }}>You did it.</h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Congratulations on your new role.
        </p>

        <div style={{ marginTop: 40, padding: 24, background: 'var(--color-bg-soft)', borderRadius: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>Know someone else who should be on Mellow?</p>
          <p style={{ marginTop: 6, fontSize: 14, color: 'var(--color-text-muted)' }}>Share it with them.</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(REFERRAL_MESSAGE)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 16, display: 'inline-block' }}
          >
            Share on WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
