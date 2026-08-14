import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function UserMenu() {
  const { user, userType, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!user || !userType) return

    async function load() {
      if (userType === 'employer') {
        const { data } = await supabase
          .from('employer_profiles')
          .select('company_name, company_slug')
          .eq('user_id', user.id)
          .maybeSingle()
        setProfile({
          name: data?.company_name || 'Your company',
          viewPath: data?.company_slug ? `/company/${data.company_slug}` : null,
        })
      } else {
        const { data } = await supabase
          .from('candidate_profiles')
          .select('id, username, full_name')
          .eq('user_id', user.id)
          .maybeSingle()
        setProfile({
          name: data?.full_name || 'Your profile',
          viewPath: data ? `/profile/${data.username || data.id}` : null,
        })
      }
    }

    load()
  }, [user, userType])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!user) return null

  const dashboardPath = userType === 'employer' ? '/employer/dashboard' : '/dashboard'
  const editPath = userType === 'employer' ? '/employer/profile/edit' : '/profile/edit'
  const initial = (profile?.name?.[0] || user.email?.[0] || '?').toUpperCase()

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'var(--color-bg-soft)',
          color: 'var(--color-primary)',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initial}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 240,
            padding: 8,
            zIndex: 30,
            background: '#fff',
            boxShadow: '0 10px 30px rgba(10, 10, 10, 0.14)',
          }}
        >
          <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
            <p style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || '…'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </p>
          </div>

          <Link to={dashboardPath} className="dropdown-item" onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          <Link to={editPath} className="dropdown-item" onClick={() => setOpen(false)}>
            Edit Profile
          </Link>
          {profile?.viewPath && (
            <Link to={profile.viewPath} className="dropdown-item" onClick={() => setOpen(false)}>
              {userType === 'employer' ? 'View Company Profile' : 'View Profile'}
            </Link>
          )}

          <div style={{ borderTop: '1px solid var(--color-border)', margin: '6px 0' }} />

          <button
            type="button"
            className="dropdown-item"
            style={{ color: '#d92d20' }}
            onClick={() => {
              setOpen(false)
              signOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
