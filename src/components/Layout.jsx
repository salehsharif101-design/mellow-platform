import { Link, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Logo from './Logo.jsx'
import UserMenu from './UserMenu.jsx'
import NavHighlight, { NEW_USER_HINT_KEYS } from './NavHighlight.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'

const NAV_LINK_STYLE = { textDecoration: 'none', fontWeight: 600, fontSize: 14 }

export default function Layout() {
  const { session, userType } = useAuth()
  const { unreadMessages } = useNotifications()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const headerRef = useRef(null)

  const dashboardPath = userType === 'employer' ? '/employer/dashboard' : '/dashboard'
  const messagesPath = userType === 'employer' ? '/employer/messages' : '/messages'
  const closeMobileMenu = () => setMobileMenuOpen(false)

  useEffect(() => {
    if (!mobileMenuOpen) return
    function handleClickOutside(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) closeMobileMenu()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileMenuOpen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="app-header" ref={headerRef}>
        <div className="app-header-inner">
          <div className="app-header-left">
            <Link to={session ? dashboardPath : '/'} style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
              <Logo />
            </Link>
            {session && (
              <button
                type="button"
                className="mobile-menu-toggle"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((o) => !o)}
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
            )}
          </div>
          <nav className="app-nav">
            {session ? (
              <>
                <div className={`app-nav-links${mobileMenuOpen ? ' mobile-open' : ''}`}>
                  <Link to={dashboardPath} style={NAV_LINK_STYLE} onClick={closeMobileMenu}>
                    Dashboard
                  </Link>
                  {userType === 'employer' ? (
                    <>
                      <NavHighlight
                        to="/employer/talent"
                        storageKey={NEW_USER_HINT_KEYS.employer}
                        style={NAV_LINK_STYLE}
                        onClick={closeMobileMenu}
                      >
                        Talent Feed
                      </NavHighlight>
                      <Link to="/employer/roles/new" style={NAV_LINK_STYLE} onClick={closeMobileMenu}>
                        Post a Role
                      </Link>
                      <Link to="/employer/roles" style={NAV_LINK_STYLE} onClick={closeMobileMenu}>
                        Manage roles
                      </Link>
                    </>
                  ) : (
                    <NavHighlight
                      to="/roles"
                      storageKey={NEW_USER_HINT_KEYS.candidate}
                      style={NAV_LINK_STYLE}
                      onClick={closeMobileMenu}
                    >
                      Browse Roles
                    </NavHighlight>
                  )}
                  <Link
                    to={messagesPath}
                    style={{ ...NAV_LINK_STYLE, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={closeMobileMenu}
                  >
                    Messages
                    {unreadMessages > 0 && (
                      <span className="notif-badge" aria-label={`${unreadMessages} unread messages`}>
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Link>
                </div>
                <UserMenu />
              </>
            ) : (
              <>
                <Link to="/login" style={NAV_LINK_STYLE}>
                  Log in
                </Link>
                <Link to="/signup" className="btn btn-primary">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer
        className="app-footer"
        style={{
          background: 'var(--color-primary)',
          color: '#ffffff',
          padding: '56px 64px',
        }}
      >
        <div
          className="footer-grid"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          <div>
            <Logo size={20} white />
            <p style={{ marginTop: 12, opacity: 0.85, fontSize: 14 }}>
              Meet people, not documents.
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
