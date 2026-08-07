import { Link } from 'react-router-dom'
import Confetti from '../../components/Confetti.jsx'

export default function OnboardingCelebration() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <Confetti />
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img
          src="/Client_to_creative.png"
          alt=""
          style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }}
        />
        <h1 style={{ marginTop: 40, fontSize: 'clamp(32px, 4vw, 44px)' }}>Your talent feed is ready.</h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          You can now browse real candidates, post your first role, and find the right person without reading a
          single CV. The best hire starts with a real conversation.
        </p>

        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/employer/talent" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
            Browse the talent feed
          </Link>
          <Link to="/employer/roles/new" className="btn btn-ghost" style={{ padding: '14px 28px', fontSize: 15 }}>
            Post a role
          </Link>
        </div>
      </div>
    </div>
  )
}
