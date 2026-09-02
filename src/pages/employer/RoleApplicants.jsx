import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { notify } from '../../lib/notify.js'
import { formatRelativeTime } from '../../lib/roleFormat.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import QuickMessageModal from '../../components/QuickMessageModal.jsx'
import CandidateNoteBox from '../../components/CandidateNoteBox.jsx'
import CandidateActivityTimeline from '../../components/CandidateActivityTimeline.jsx'
import RoleAnalyticsPanel from '../../components/RoleAnalyticsPanel.jsx'

const STATUS_LABELS = { applied: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }
const STATUS_COLORS = {
  applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  reviewing: { background: '#fff6e0', color: '#8a6100' },
  shortlisted: { background: '#e3f9e9', color: '#0f7a3d' },
  rejected: { background: '#fdeceb', color: '#d92d20' },
}
const CUSTOM_STAGE_COLOR = { background: '#f1e8fd', color: '#6b21a8' }

// A custom pipeline stage is layered on top of the 'reviewing' status
// rather than replacing it (see migration 0056) — this turns a raw <select>
// value ('applied' | 'reviewing' | 'shortlisted' | 'rejected' |
// `custom:<stage id>`) into the { status, customStageId } pair applications
// actually stores.
function parseStageValue(value) {
  if (value.startsWith('custom:')) return { status: 'reviewing', customStageId: value.slice(7) }
  return { status: value, customStageId: null }
}

function stageValueFor(application) {
  return application.custom_stage_id ? `custom:${application.custom_stage_id}` : application.status
}

export default function RoleApplicants() {
  const { roleId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [applications, setApplications] = useState([])
  const [pipelineStages, setPipelineStages] = useState([])
  const [notesByCandidate, setNotesByCandidate] = useState({})
  const [activityByCandidate, setActivityByCandidate] = useState({})
  const [hires, setHires] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [activeSkills, setActiveSkills] = useState(new Set())
  const [pendingRejectionId, setPendingRejectionId] = useState(null)
  const [messagingApplication, setMessagingApplication] = useState(null)
  const [messageSent, setMessageSent] = useState(false)
  const [notesOpenIds, setNotesOpenIds] = useState(new Set())
  const [activityOpenIds, setActivityOpenIds] = useState(new Set())

  useEffect(() => {
    if (!user) return

    async function load() {
      const { employerId } = await resolveEmployerId(user.id)
      const { data: roleRow, error: roleError } = employerId
        ? await supabase
            .from('roles')
            .select('id, title, employer_id, view_count')
            .eq('id', roleId)
            .eq('employer_id', employerId)
            .maybeSingle()
        : { data: null, error: null }

      if (roleError || !roleRow) {
        setError('Role not found.')
        setLoading(false)
        return
      }
      setRole(roleRow)

      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select(
          'id, status, custom_stage_id, applied_at, viewed_at, candidate_profiles(id, user_id, username, full_name, avatar_url, job_title, current_company, skills, years_of_experience, availability)',
        )
        .eq('role_id', roleId)
        .order('applied_at', { ascending: false })

      if (appsError) {
        setError(appsError.message)
        setLoading(false)
        return
      }
      setApplications(apps || [])

      const candidateIds = (apps || []).map((a) => a.candidate_profiles?.id).filter(Boolean)

      const [{ data: stages }, { data: notes }, { data: activity }, { data: hireRows }] = await Promise.all([
        supabase.from('role_pipeline_stages').select('id, name, position').eq('role_id', roleId).order('position', { ascending: true }),
        candidateIds.length > 0
          ? supabase.from('candidate_notes').select('id, candidate_id, body, updated_at').eq('role_id', roleId)
          : Promise.resolve({ data: [] }),
        candidateIds.length > 0
          ? supabase
              .from('candidate_activity_log')
              .select('id, candidate_id, event_type, detail, created_at')
              .eq('employer_id', roleRow.employer_id)
              .in('candidate_id', candidateIds)
              .or(`role_id.eq.${roleId},role_id.is.null`)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('hires').select('candidate_id, confirmed_at').eq('role_id', roleId),
      ])

      setPipelineStages(stages || [])

      const noteMap = {}
      ;(notes || []).forEach((n) => {
        noteMap[n.candidate_id] = n
      })
      setNotesByCandidate(noteMap)

      const activityMap = {}
      ;(activity || []).forEach((e) => {
        if (!activityMap[e.candidate_id]) activityMap[e.candidate_id] = []
        activityMap[e.candidate_id].push(e)
      })
      setActivityByCandidate(activityMap)

      setHires(hireRows || [])
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

  function toggleOpen(setter, id) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // The employer's personal shortlist (used by Talent Feed and
  // /employer/shortlist) is a separate table from an application's status.
  // Setting an application to "Shortlisted" here — or moving it away from
  // that status — keeps the shortlist table in sync so both reflect the
  // same state. Custom pipeline stages never touch this: they only ever set
  // status back to 'reviewing', which this already treats as "not shortlisted".
  async function syncShortlist(candidateId, newStatus, previousStatus) {
    if (!role?.employer_id || !candidateId) return
    if (newStatus === 'shortlisted' && previousStatus !== 'shortlisted') {
      const { data } = await supabase
        .from('shortlists')
        .upsert(
          { employer_id: role.employer_id, candidate_id: candidateId, role_id: role.id },
          { onConflict: 'employer_id,candidate_id,role_id', ignoreDuplicates: true },
        )
        .select()
        .maybeSingle()
      // ignoreDuplicates means an already-shortlisted candidate (e.g.
      // bounced through "reviewing" and back) returns no row here, so this
      // only ever fires for a genuinely new shortlist entry — otherwise
      // they'd get a duplicate notification every time.
      if (data) notify('shortlist-notification', { shortlistId: data.id })
    } else if (previousStatus === 'shortlisted' && newStatus !== 'shortlisted') {
      await supabase
        .from('shortlists')
        .delete()
        .eq('employer_id', role.employer_id)
        .eq('candidate_id', candidateId)
        .eq('role_id', role.id)
    }
  }

  async function changeStatus(applicationId, rawValue) {
    const application = applications.find((a) => a.id === applicationId)
    const previousStatus = application?.status
    const { status, customStageId } = parseStageValue(rawValue)
    setUpdatingId(applicationId)
    const { data, error: updateError } = await supabase
      .from('applications')
      .update({ status, custom_stage_id: customStageId })
      .eq('id', applicationId)
      .select()
      .single()
    if (!updateError) {
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status: data.status, custom_stage_id: data.custom_stage_id } : a)),
      )
      await syncShortlist(application?.candidate_profiles?.id, status, previousStatus)
    }
    setUpdatingId(null)
  }

  function handleStatusSelect(applicationId, rawValue) {
    const { status } = parseStageValue(rawValue)
    if (status === 'rejected') {
      setPendingRejectionId(applicationId)
      return
    }
    setPendingRejectionId(null)
    changeStatus(applicationId, rawValue)
  }

  async function confirmRejection(applicationId, shouldNotify) {
    await changeStatus(applicationId, 'rejected')
    if (shouldNotify) {
      notify('rejection-notification', { applicationId })
    }
    setPendingRejectionId(null)
  }

  // Opening a candidate's profile from the applicant list is what counts as
  // "viewed" — regardless of whether they go on to watch the intro video.
  // Marked optimistically so the New badge clears instantly; the write is
  // fire-and-forget since a failure here shouldn't block navigation.
  function handleOpenProfile(a) {
    if (!a.viewed_at) {
      const now = new Date().toISOString()
      setApplications((prev) => prev.map((x) => (x.id === a.id ? { ...x, viewed_at: now } : x)))
      supabase.from('applications').update({ viewed_at: now }).eq('id', a.id).then(() => {})
    }
    navigate(`/profile/${a.candidate_profiles?.username || a.candidate_profiles?.id}`)
  }

  if (loading) return null

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length
  const views = role.view_count || 0
  const conversion = views > 0 ? Math.round((applications.length / views) * 100) : null

  return (
    <div className="section">
      <Link to="/employer/roles" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
        ← Manage roles
      </Link>
      <h1 style={{ fontSize: 28, marginTop: 8 }}>Applicants for {role.title}</h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
        {views} view{views === 1 ? '' : 's'} · {applications.length} applied · {shortlistedCount} shortlisted · {rejectedCount} rejected
        {conversion !== null && ` · ${conversion}% view-to-apply`}
      </p>

      <RoleAnalyticsPanel role={role} applications={applications} hires={hires} />

      {messageSent && (
        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: '#0f7a3d' }}>Message sent</p>
      )}

      {applications.length === 0 ? (
        <EmptyState
          heading="No applicants yet"
          body="Applications will show up here as talent applies to this role."
          illustration="/Collaborate2.png"
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
                const unviewed = !a.viewed_at
                const customStage = a.custom_stage_id ? pipelineStages.find((s) => s.id === a.custom_stage_id) : null
                const badgeLabel = customStage ? customStage.name : STATUS_LABELS[a.status]
                const badgeColors = customStage ? CUSTOM_STAGE_COLOR : STATUS_COLORS[a.status]
                const note = notesByCandidate[c.id]
                const events = activityByCandidate[c.id] || []
                const notesOpen = notesOpenIds.has(a.id)
                const activityOpen = activityOpenIds.has(a.id)
                return (
                  <div
                    key={a.id}
                    className="card"
                    onClick={() => handleOpenProfile(a)}
                    style={{ padding: 20, cursor: 'pointer', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={52} />
                        {unviewed && (
                          <span
                            aria-label="Unviewed applicant"
                            style={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: 'var(--color-primary)',
                              border: '2px solid #fff',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: 700, fontSize: 16 }}>{c.full_name}</p>
                          <span className="tag" style={{ fontSize: 11, ...badgeColors }}>
                            {badgeLabel}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                          {c.years_of_experience && ` · ${c.years_of_experience}`}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          Applied {formatRelativeTime(a.applied_at)}
                        </p>
                        {(c.skills?.length > 0 || c.availability) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {c.availability && (
                              <span className="tag" style={{ fontSize: 11, background: '#e3f9e9', color: '#0f7a3d' }}>
                                Available: {c.availability}
                              </span>
                            )}
                            {c.skills?.slice(0, 4).map((s) => (
                              <span key={s} className="tag" style={{ fontSize: 11 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '8px 12px' }}
                          onClick={() => setMessagingApplication(a)}
                        >
                          Message
                        </button>
                        <select
                          className="input"
                          value={pendingRejectionId === a.id ? 'rejected' : stageValueFor(a)}
                          disabled={updatingId === a.id}
                          onChange={(e) => handleStatusSelect(a.id, e.target.value)}
                          style={{ width: 'auto', padding: '8px 12px' }}
                        >
                          <option value="applied">{STATUS_LABELS.applied}</option>
                          <option value="reviewing">{STATUS_LABELS.reviewing}</option>
                          {pipelineStages.map((s) => (
                            <option key={s.id} value={`custom:${s.id}`}>
                              {s.name}
                            </option>
                          ))}
                          <option value="shortlisted">{STATUS_LABELS.shortlisted}</option>
                          <option value="rejected">{STATUS_LABELS.rejected}</option>
                        </select>
                      </div>
                    </div>

                    <div
                      style={{ display: 'flex', gap: 8, marginTop: 14 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => toggleOpen(setNotesOpenIds, a.id)}
                      >
                        {notesOpen ? 'Hide note' : note?.body ? 'View note' : 'Add note'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => toggleOpen(setActivityOpenIds, a.id)}
                      >
                        {activityOpen ? 'Hide activity' : `Activity${events.length > 0 ? ` (${events.length})` : ''}`}
                      </button>
                    </div>

                    {notesOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}
                      >
                        <CandidateNoteBox
                          employerId={role.employer_id}
                          candidateId={c.id}
                          roleId={role.id}
                          userId={user.id}
                          initialBody={note?.body || ''}
                          initialUpdatedAt={note?.updated_at || null}
                        />
                      </div>
                    )}

                    {activityOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}
                      >
                        <CandidateActivityTimeline events={events} />
                      </div>
                    )}

                    {pendingRejectionId === a.id && (
                      <div
                        className="card"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: 16, padding: '14px 18px', background: 'var(--color-bg-soft)', border: 'none' }}
                      >
                        <p style={{ fontSize: 14, fontWeight: 600 }}>
                          Would you like to notify them that you have decided to move forward with other
                          talent?
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

      {messagingApplication && (
        <QuickMessageModal
          recipientUserId={messagingApplication.candidate_profiles?.user_id}
          recipientLabel={messagingApplication.candidate_profiles?.full_name}
          onClose={() => setMessagingApplication(null)}
          onSent={() => {
            setMessageSent(true)
            setTimeout(() => setMessageSent(false), 3000)
          }}
        />
      )}
    </div>
  )
}
