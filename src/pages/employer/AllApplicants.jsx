import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatRelativeTime } from '../../lib/roleFormat.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import EmptyState from '../../components/EmptyState.jsx'

const STATUS_LABELS = { applied: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }
const STATUS_COLORS = {
  applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  reviewing: { background: '#fff6e0', color: '#8a6100' },
  shortlisted: { background: '#e3f9e9', color: '#0f7a3d' },
  rejected: { background: '#fdeceb', color: '#d92d20' },
}

// A cross-role index — deliberately read-only/navigational rather than a
// second place to change an application's status (RoleApplicants.jsx
// already owns that, per role; duplicating it here would just create two
// places that can drift out of sync).
export default function AllApplicants() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: employer, error: employerError } = await supabase
        .from('employer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (employerError) {
        setError(employerError.message)
        setLoading(false)
        return
      }
      if (!employer) {
        setLoading(false)
        return
      }

      const { data: roles } = await supabase.from('roles').select('id, title').eq('employer_id', employer.id)
      const roleIds = (roles || []).map((r) => r.id)
      const roleTitleById = Object.fromEntries((roles || []).map((r) => [r.id, r.title]))

      if (roleIds.length === 0) {
        setApplications([])
        setLoading(false)
        return
      }

      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('id, status, applied_at, role_id, candidate_profiles(id, username, full_name, avatar_url, job_title)')
        .in('role_id', roleIds)
        .order('applied_at', { ascending: false })

      if (appsError) setError(appsError.message)
      else setApplications((apps || []).map((a) => ({ ...a, roleTitle: roleTitleById[a.role_id] })))

      setLoading(false)
    }

    load()
  }, [user])

  if (loading) return null

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="section">
      <h1 style={{ fontSize: 28 }}>All applicants</h1>

      {applications.length === 0 ? (
        <EmptyState
          heading="No applications yet"
          body="Applications will show up here as talent applies to your roles."
          illustration="/Your_Requested_Is_Posted.png"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, maxWidth: 720 }}>
          {applications.map((a) => {
            const c = a.candidate_profiles
            if (!c) return null
            return (
              <div
                key={a.id}
                className="card"
                onClick={() => navigate(`/employer/roles/${a.role_id}/applicants`)}
                style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              >
                <Link
                  to={`/profile/${c.username || c.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0, lineHeight: 0 }}
                >
                  <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={44} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{c.full_name}</p>
                    <span className="tag" style={{ fontSize: 11, ...STATUS_COLORS[a.status] }}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Applied for {a.roleTitle} · {formatRelativeTime(a.applied_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
