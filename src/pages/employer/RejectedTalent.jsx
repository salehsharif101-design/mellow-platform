import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { formatRelativeTime } from '../../lib/roleFormat.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import EmptyState from '../../components/EmptyState.jsx'

export default function RejectedTalent() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    async function load() {
      const { employerId } = await resolveEmployerId(user.id)
      if (!employerId) {
        setLoading(false)
        return
      }

      const { data, error: appsError } = await supabase
        .from('applications')
        .select(
          'id, role_id, status_changed_at, applied_at, roles!inner(id, title, slug, employer_id), candidate_profiles(id, username, full_name, avatar_url, job_title, current_company, location, skills)',
        )
        .eq('roles.employer_id', employerId)
        .eq('status', 'rejected')
        .order('status_changed_at', { ascending: false })

      if (appsError) setError(appsError.message)
      else setEntries(data || [])

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

  // Group by role so each role's rejected candidates stay separate.
  const groups = []
  const groupByKey = new Map()
  entries.forEach((entry) => {
    const key = entry.role_id
    let group = groupByKey.get(key)
    if (!group) {
      group = { key, role: entry.roles, entries: [] }
      groupByKey.set(key, group)
      groups.push(group)
    }
    group.entries.push(entry)
  })

  return (
    <div className="section">
      <h1 style={{ fontSize: 28 }}>Rejected talent</h1>

      {entries.length === 0 ? (
        <EmptyState
          heading="No rejected candidates yet"
          body="Once you decide not to move forward with an applicant, they'll show up here so you can keep track of your hiring pipeline."
          illustration="/plant.PNG"
        />
      ) : (
        groups.map((group) => (
          <div key={group.key} style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontSize: 19 }}>{group.role?.title || 'Untitled role'}</h2>
              <Link to={`/employer/roles/${group.key}/applicants`} className="btn btn-primary">
                View applicants
              </Link>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 20,
                marginTop: 16,
              }}
            >
              {group.entries.map((entry) => {
                const c = entry.candidate_profiles
                if (!c) return null
                return (
                  <div key={entry.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Link to={`/profile/${c.username || c.id}`} style={{ flexShrink: 0, lineHeight: 0 }}>
                        <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={48} />
                      </Link>
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/profile/${c.username || c.id}`} style={{ textDecoration: 'none' }}>
                          <h3 style={{ fontSize: 16 }}>{c.full_name}</h3>
                        </Link>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                          {c.location && ` · ${c.location}`}
                        </p>
                      </div>
                    </div>

                    {c.skills?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {c.skills.map((s) => (
                          <span key={s} className="tag" style={{ fontSize: 12 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Applied for{' '}
                      <Link
                        to={`/employer/roles/${entry.role_id}/applicants`}
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                      >
                        {entry.roles?.title}
                      </Link>
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Rejected {formatRelativeTime(entry.status_changed_at || entry.applied_at)}
                    </p>

                    <Link to={`/profile/${c.username || c.id}`} className="btn btn-primary" style={{ textAlign: 'center' }}>
                      View profile
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
