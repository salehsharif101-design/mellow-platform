import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '../../components/Logo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

export default function Welcome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountDeleted = searchParams.get('accountDeleted') === '1'
  const { session, loading: authLoading } = useAuth()

  useEffect(() => {
    // Logged-in users should never see the landing page — bounce them
    // straight to their dashboard. Looked up directly rather than via the
    // AuthContext profile fetch, which can lag behind session by a beat.
    if (authLoading || !session) return
    let cancelled = false
    supabase
      .from('users')
      .select('user_type')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        navigate(data?.user_type === 'employer' ? '/employer/dashboard' : '/dashboard', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [session, authLoading, navigate])

  if (authLoading || session) return null

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

          {accountDeleted && (
            <p
              style={{
                marginBottom: 20,
                padding: '10px 16px',
                borderRadius: 'var(--radius-input)',
                background: 'var(--color-bg-soft)',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Your account has been deleted.
            </p>
          )}

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
