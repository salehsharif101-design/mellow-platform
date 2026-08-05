import { useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo.jsx'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        padding: '48px',
      }}
      className="welcome-page"
    >
      <div
        className="split-row"
        style={{
          width: '100%',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <div className="split-row-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ marginBottom: 40 }}>
            <Logo size={28} />
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            Welcome to Mellow
          </h1>
          <p style={{ marginTop: 18, fontSize: 18, color: 'var(--color-text-muted)' }}>
            Meet people, not documents
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 36, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '13px 24px', fontSize: 15, whiteSpace: 'nowrap' }}
              onClick={() => navigate('/login?type=candidate')}
            >
              Sign in as talent
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '13px 24px', fontSize: 15, whiteSpace: 'nowrap' }}
              onClick={() => navigate('/login?type=employer')}
            >
              Sign in as employer
            </button>
          </div>
        </div>

        <div className="split-row-media">
          <img src="/Floating girl.PNG" alt="" />
        </div>
      </div>
    </div>
  )
}
