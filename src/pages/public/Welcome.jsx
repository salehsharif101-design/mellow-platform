import { useNavigate } from 'react-router-dom'

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
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 40,
          width: '100%',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <img src="/mellow_logofont_trimmed.png" alt="Mellow" style={{ height: 32, marginBottom: 40 }} />

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

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <img
            src="/Floating girl.PNG"
            alt=""
            style={{ width: '100%', maxWidth: 520, height: 'auto' }}
          />
        </div>
      </div>
    </div>
  )
}
