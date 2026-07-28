import { Link, Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Layout() {
  const { session, userType, signOut } = useAuth()

  const dashboardPath = userType === 'employer' ? '/employer/dashboard' : '/dashboard'
  const messagesPath = userType === 'employer' ? '/employer/messages' : '/messages'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 28, whiteSpace: 'nowrap' }}>
          {session ? (
            <>
              <Link to={dashboardPath} style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Dashboard
              </Link>
              <Link to={messagesPath} style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Messages
              </Link>
              <button className="btn btn-ghost" onClick={signOut}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer
        style={{
          background: 'var(--color-primary)',
          color: '#ffffff',
          padding: '56px 48px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          <div>
            <Logo size={20} white />
            <p style={{ marginTop: 12, opacity: 0.85, fontSize: 14 }}>
              Hire on video, not paper.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 12 }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, opacity: 0.85 }}>
              <Link to="/roles" style={{ color: '#fff', textDecoration: 'none' }}>Browse roles</Link>
              <Link to="/dashboard" style={{ color: '#fff', textDecoration: 'none' }}>Dashboard</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 12 }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, opacity: 0.85 }}>
              <span>hello@joinmellow.xyz</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
