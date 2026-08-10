import { Link, Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Layout() {
  const { session, userType, signOut } = useAuth()

  const dashboardPath = userType === 'employer' ? '/employer/dashboard' : '/dashboard'
  const messagesPath = userType === 'employer' ? '/employer/messages' : '/messages'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="app-header">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <nav className="app-nav">
          {session ? (
            <>
              <Link to={dashboardPath} style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Dashboard
              </Link>
              {userType === 'employer' && (
                <>
                  <Link to="/employer/roles" style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                    Manage roles
                  </Link>
                  <Link to="/employer/profile/edit" style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                    Edit profile
                  </Link>
                </>
              )}
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
        className="app-footer"
        style={{
          background: 'var(--color-primary)',
          color: '#ffffff',
          padding: '56px 48px',
        }}
      >
        <div
          className="footer-grid"
          style={{
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
              {session && userType === 'candidate' && (
                <>
                  <Link to="/roles" style={{ color: '#fff', textDecoration: 'none' }}>Browse Roles</Link>
                  <Link to="/dashboard" style={{ color: '#fff', textDecoration: 'none' }}>Dashboard</Link>
                  <Link to="/messages" style={{ color: '#fff', textDecoration: 'none' }}>Messages</Link>
                </>
              )}
              {session && userType === 'employer' && (
                <>
                  <Link to="/employer/roles/new" style={{ color: '#fff', textDecoration: 'none' }}>Post a Role</Link>
                  <Link to="/employer/talent" style={{ color: '#fff', textDecoration: 'none' }}>Talent Feed</Link>
                  <Link to="/employer/dashboard" style={{ color: '#fff', textDecoration: 'none' }}>Dashboard</Link>
                  <Link to="/employer/messages" style={{ color: '#fff', textDecoration: 'none' }}>Messages</Link>
                </>
              )}
              {!session && (
                <>
                  <a href="https://joinmellow.xyz/talent.html" style={{ color: '#fff', textDecoration: 'none' }}>For Talent</a>
                  <a href="https://joinmellow.xyz/employers.html" style={{ color: '#fff', textDecoration: 'none' }}>For Employers</a>
                  <a href="https://joinmellow.xyz/about.html" style={{ color: '#fff', textDecoration: 'none' }}>About</a>
                </>
              )}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 12 }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, opacity: 0.85 }}>
              <span>hello@joinmellow.xyz</span>
              <Link to="/privacy" style={{ color: '#fff', textDecoration: 'none' }}>Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
