import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

export default function EmployerDashboard() {
  const { user } = useAuth()
  const [employer, setEmployer] = useState(null)
  const [roles, setRoles] = useState([])
  const [applications, setApplications] = useState([])
  const [shortlistCount, setShortlistCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: emp } = await supabase
        .from('employer_profiles')
        .select('id, company_name, company_slug')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!emp) {
        setLoading(false)
        return
      }
      setEmployer(emp)

      const { data: myRoles } = await supabase
        .from('roles')
        .select('id, title, is_active')
        .eq('employer_id', emp.id)
        .order('created_at', { ascending: false })
      setRoles(myRoles || [])

      const roleIds = (myRoles || []).map((r) => r.id)
      if (roleIds.length > 0) {
        const { data: apps } = await supabase
          .from('applications')
          .select('id, status, role_id, candidate_profiles(id, username, full_name)')
          .in('role_id', roleIds)
        setApplications(apps || [])
      }

      const { count } = await supabase
        .from('shortlists')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', emp.id)
      setShortlistCount(count || 0)

      setLoading(false)
    }

    load()
  }, [user])

  async function shareProfile() {
    const url = `https://beta.joinmellow.xyz/company/${employer.company_slug}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable or blocked (older browser, denied permission,
      // non-trusted context) — fall back to the legacy selection-based copy.
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (loading) return null

  if (!employer) {
    return (
      <div className="section">
        <p>
          Finish setting up your company profile. <Link to="/employer/onboarding">Continue →</Link>
        </p>
      </div>
    )
  }

  const activeRoles = roles.filter((r) => r.is_active)

  const applicationsByRole = roles.map((role) => ({
    role,
    applications: applications.filter((a) => a.role_id === role.id),
  }))

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>{employer.company_name} dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/employer/profile/edit" className="btn btn-primary">
            Edit profile
          </Link>
          {employer.company_slug && (
            <>
              <Link to={`/company/${employer.company_slug}`} className="btn btn-ghost">
                View Profile
              </Link>
              <button type="button" className="btn btn-ghost" onClick={shareProfile}>
                {linkCopied ? 'Link copied!' : 'Share profile'}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 28 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Active roles</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{activeRoles.length}</p>
          <Link to="/employer/roles/new" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
            Post a new role →
          </Link>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Applications received</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{applications.length}</p>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16 }}>Shortlisted candidates</h3>
          <p style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{shortlistCount}</p>
          <Link to="/employer/shortlist" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
            View shortlist →
          </Link>
        </div>
      </div>

      {roles.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h3 style={{ fontSize: 18, marginBottom: 14 }}>Applications by role</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {applicationsByRole.map(({ role, applications: roleApps }) => (
              <div key={role.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontWeight: 700 }}>
                    {role.title} {!role.is_active && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(closed)</span>}
                  </p>
                  <span className="tag">{roleApps.length} applicant{roleApps.length === 1 ? '' : 's'}</span>
                </div>
                {roleApps.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {roleApps.map((a) => (
                      <Link
                        key={a.id}
                        to={`/profile/${a.candidate_profiles?.username || a.candidate_profiles?.id}`}
                        style={{ fontSize: 14, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {a.candidate_profiles?.full_name} · {a.status}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
