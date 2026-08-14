import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import EmptyState from '../../components/EmptyState.jsx'

const STATUSES = ['applied', 'reviewing', 'shortlisted', 'rejected']
const STATUS_LABELS = { applied: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }

export default function RoleApplicants() {
  const { roleId } = useParams()
  const { user } = useAuth()

  const [role, setRole] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [activeSkills, setActiveSkills] = useState(new Set())
  const [pendingRejectionId, setPendingRejectionId] = useState(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: roleRow, error: roleError } = await supabase
        .from('roles')
        .select('id, title, employer_id, employer_profiles!inner(user_id)')
        .eq('id', roleId)
        .eq('employer_profiles.user_id', user.id)
        .maybeSingle()

      if (roleError || !roleRow) {
        setError('Role not found.')
        setLoading(false)
        return
      }
      setRole(roleRow)

      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select(
          'id, status, applied_at, candidate_profiles(id, username, full_name, avatar_url, job_title, current_company, skills)',
        )
        .eq('role_id', roleId)
        .order('applied_at', { ascending: false })

      if (appsError) setError(appsError.message)
      else setApplications(apps || [])
      setLoading(false)
    }

    load()
  }, [user, roleId])

  const allSkills = useMemo(() => {
    const set = new Set()
    applications.forEach((a) => (a.candidate_profiles?.skills || []).forEach((s) => set.add(s)))
    return Array.from(set).sort()
  }, [applications])

  const filtered = useMemo(() => {
    if (activeSkills.size === 0) return applications
    return applications.filter((a) => (a.candidate_profiles?.skills || []).some((s) => activeSkills.has(s)))
  }, [applications, activeSkills])

  function toggleSkill(skill) {
    setActiveSkills((prev) => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      return next
    })
  }

  // The employer's personal shortlist (used by Talent Feed and
  // /employer/shortlist) is a separate table from an application's status.
  // Setting an application to "Shortlisted" here — or moving it away from
  // that status — keeps the shortlist table in sync so both reflect the
  // same state.
  async function syncShortlist(candidateId, newStatus, previousStatus) {
    if (!role?.employer_id || !candidateId) return
    if (newStatus === 'shortlisted' && previousStatus !== 'shortlisted') {
      await supabase
        .from('shortlists')
        .upsert({ employer_id: role.employer_id, candidate_id: candidateId }, { onConflict: 'employer_id,candidate_id', ignoreDuplicates: true })
    } else if (previousStatus === 'shortlisted' && newStatus !== 'shortlisted') {
      await supabase.from('shortlists').delete().eq('employer_id', role.employer_id).eq('candidate_id', candidateId)
    }
  }

  async function changeStatus(applicationId, status) {
    const application = applications.find((a) => a.id === applicationId)
    const previousStatus = application?.status
    setUpdatingId(applicationId)
    const { data, error: updateError } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', applicationId)
      .select()
      .single()
    if (!updateError) {
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status: data.status } : a)))
      await syncShortlist(application?.candidate_profiles?.id, status, previousStatus)
    }
    setUpdatingId(null)
  }

  function handleStatusSelect(applicationId, newStatus) {
    if (newStatus === 'rejected') {
      setPendingRejectionId(applicationId)
      return
    }
    setPendingRejectionId(null)
    changeStatus(applicationId, newStatus)
  }

  async function confirmRejection(applicationId, shouldNotify) {
    await changeStatus(applicationId, 'rejected')
    if (shouldNotify) {
      notify('rejection-notification', { applicationId })
    }
    setPendingRejectionId(null)
  }

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
      <Link to="/employer/roles" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
        ← Manage roles
      </Link>
      <h1 style={{ fontSize: 28, marginTop: 8 }}>Applicants for {role.title}</h1>

      {applications.length === 0 ? (
        <EmptyState
          heading="No applicants yet"
          body="Applications will show up here as candidates apply to this role."
        />
      ) : (
        <>
          {allSkills.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>Filter by skill:</span>
              {allSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className="tag"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: activeSkills.has(skill) ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                    color: activeSkills.has(skill) ? '#fff' : 'var(--color-primary)',
                  }}
                >
                  {skill}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p style={{ marginTop: 32, color: 'var(--color-text-muted)' }}>No applicants match that filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24, maxWidth: 760 }}>
              {filtered.map((a) => {
                const c = a.candidate_profiles
                if (!c) return null
                return (
                  <div key={a.id} className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={52} />

                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ fontWeight: 700, fontSize: 16 }}>{c.full_name}</p>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                        </p>
                        {c.skills?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {c.skills.map((s) => (
                              <span key={s} className="tag" style={{ fontSize: 11 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <select
                          className="input"
                          value={pendingRejectionId === a.id ? 'rejected' : a.status}
                          disabled={updatingId === a.id}
                          onChange={(e) => handleStatusSelect(a.id, e.target.value)}
                          style={{ width: 'auto', padding: '8px 12px' }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <Link to={`/profile/${c.username || c.id}`} className="btn btn-ghost">
                          View profile
                        </Link>
                      </div>
                    </div>

                    {pendingRejectionId === a.id && (
                      <div
                        className="card"
                        style={{ marginTop: 16, padding: '14px 18px', background: 'var(--color-bg-soft)', border: 'none' }}
                      >
                        <p style={{ fontSize: 14, fontWeight: 600 }}>
                          Would you like to notify this candidate that you have decided to move forward with other
                          candidates?
                        </p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={updatingId === a.id}
                            onClick={() => confirmRejection(a.id, true)}
                          >
                            Yes, send email
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={updatingId === a.id}
                            onClick={() => confirmRejection(a.id, false)}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
