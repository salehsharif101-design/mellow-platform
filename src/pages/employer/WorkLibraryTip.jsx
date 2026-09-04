import { useNavigate } from 'react-router-dom'

export default function WorkLibraryTip() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '48px 24px' }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img src="/Quality.PNG" alt="" style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }} />
        <h1 style={{ marginTop: 40, fontSize: 'clamp(32px, 4vw, 44px)', color: 'var(--color-primary)' }}>
          A tip before you start browsing
        </h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          When you find talent you like, check their work video library. These are videos where talent shows
          you how they actually think and operate. A designer walking through a rebrand, a developer solving a
          problem live, a marketer breaking down a campaign. It is the closest thing to working with someone before
          you hire them.
        </p>
        <div style={{ marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => navigate('/employer/talent')}
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            Browse the talent feed
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => navigate('/employer/roles/new')}
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            Post a role
          </button>
        </div>
      </div>
    </div>
  )
}
