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
import CandidateNotesThread from '../../components/CandidateNotesThread.jsx'
import CandidateActivityTimeline from '../../components/CandidateActivityTimeline.jsx'
import RoleAnalyticsPanel from '../../components/RoleAnalyticsPanel.jsx'
import ManageStagesModal from '../../components/ManageStagesModal.jsx'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ensureBuiltinStages,
  backfillBuiltinStageIds,
  statusForStage,
  stageBadgeColor,
} from '../../lib/pipelineStages.js'

const ADD_CUSTOM_STAGE_VALUE = '__add_custom_stage__'

// Every non-fixed stage — the builtin Reviewing/Shortlisted rows and any
// employer-added custom one — is layered on top of the 'reviewing' status
// rather than replacing it, except the builtin Shortlisted row (see
// statusForStage in lib/pipelineStages.js). This turns a raw <select> value
// ('applied' | 'rejected' | `custom:<stage id>`) into the
// { status, customStageId } pair applications actually stores. 'applied'
// and 'rejected' are the only two values that are never a stage row.
function parseStageValue(value, roleId, stages) {
  if (value.startsWith('custom:')) {
    const id = value.slice(7)
    const stage = stages.find((s) => s.id === id) || { id }
    return { status: statusForStage(stage, roleId), customStageId: id }
  }
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
  const [statusError, setStatusError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [activeSkills, setActiveSkills] = useState(new Set())
  const [pendingRejectionId, setPendingRejectionId] = useState(null)
  const [messagingApplication, setMessagingApplication] = useState(null)
  const [messageSent, setMessageSent] = useState(false)
  const [notesOpenIds, setNotesOpenIds] = useState(new Set())
  const [activityOpenIds, setActivityOpenIds] = useState(new Set())
  const [addingStageId, setAddingStageId] = useState(null)
  const [newStageDraft, setNewStageDraft] = useState('')
  const [showManageStages, setShowManageStages] = useState(false)

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

      const [{ data: stagesData }, { data: notes }, { data: activity }, { data: hireRows }] = await Promise.all([
        supabase.from('role_pipeline_stages').select('id, name, position').eq('role_id', roleId).order('position', { ascending: true }),
        candidateIds.length > 0
          ? supabase
              .from('candidate_notes')
              .select('id, candidate_id, author_email, body, created_at')
              .eq('role_id', roleId)
              .order('created_at', { ascending: false })
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

      const seededStages = await ensureBuiltinStages(supabase, roleId, stagesData || [])
      setPipelineStages(seededStages)
      const patchedApps = await backfillBuiltinStageIds(supabase, roleId, apps || [], seededStages)
      setApplications(patchedApps)

      const noteMap = {}
      ;(notes || []).forEach((n) => {
        if (!noteMap[n.candidate_id]) noteMap[n.candidate_id] = []
        noteMap[n.candidate_id].push(n)
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

  // Prepends a synthetic activity-log entry to a candidate's timeline the
  // moment an action succeeds, so the panel reflects it immediately instead
  // of only after the next full page load (the real row — inserted by a DB
  // trigger, see migration 0057 — is what a reload will show; this is just
  // client-side to close that gap for the rest of the current session).
  function prependActivity(candidateId, event) {
    setActivityByCandidate((prev) => ({
      ...prev,
      [candidateId]: [
        { id: `local-${Date.now()}-${Math.random()}`, created_at: new Date().toISOString(), ...event },
        ...(prev[candidateId] || []),
      ],
    }))
  }

  // The employer's personal shortlist (used by Talent Feed and
  // /employer/shortlist) is a separate table from an application's status.
  // Setting an application to "Shortlisted" here — or moving it away from
  // that status — keeps the shortlist table in sync so both reflect the
  // same state. Custom pipeline stages never touch this: they only ever set
  // status back to 'reviewing', which this already treats as "not shortlisted".
  // Returns which of the two (if either) actually happened, so the caller
  // can reflect it in the activity timeline right away.
  async function syncShortlist(candidateId, newStatus, previousStatus) {
    if (!role?.employer_id || !candidateId) return null
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
      if (data) {
        notify('shortlist-notification', { shortlistId: data.id })
        return 'shortlisted'
      }
      return null
    } else if (previousStatus === 'shortlisted' && newStatus !== 'shortlisted') {
      await supabase
        .from('shortlists')
        .delete()
        .eq('employer_id', role.employer_id)
        .eq('candidate_id', candidateId)
        .eq('role_id', role.id)
      return 'unshortlisted'
    }
    return null
  }

  // Creates a custom stage from the "+ Add custom stage" option in an
  // applicant card's dropdown (see the select's onChange below) — the new
  // stage is appended (last position, right before Rejected) to the shared
  // pipelineStages list, which makes it show up in every applicant card's
  // dropdown on this role immediately, and this candidate is moved into it
  // right away since that's the natural intent of adding a stage from a
  // specific candidate's dropdown. The employer can freely reorder it
  // afterward from Manage Stages.
  //
  // The id is generated client-side and sent explicitly on insert (Postgres
  // only applies a column's default when it's omitted, so this is a normal,
  // valid insert) specifically so pipelineStages and this candidate's
  // custom_stage_id can both be set optimistically, in the same synchronous
  // update, the moment Enter is pressed — without it, there's a real gap
  // (the insert, then a separate update) during which the dropdown falls
  // back to showing the underlying status ("Reviewing") until both
  // requests resolve, which is what this fixes.
  async function submitNewStage(applicationId) {
    const name = newStageDraft.trim()
    setAddingStageId(null)
    setNewStageDraft('')
    if (!name) return

    const application = applications.find((a) => a.id === applicationId)
    const originalStatus = application?.status
    const originalCustomStageId = application?.custom_stage_id ?? null

    const nextPosition = pipelineStages.length > 0 ? Math.max(...pipelineStages.map((s) => s.position)) + 1 : 0
    const stageId = crypto.randomUUID()

    setPipelineStages((prev) => [...prev, { id: stageId, name, position: nextPosition }])
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: 'reviewing', custom_stage_id: stageId } : a)),
    )

    const { error: insertError } = await supabase
      .from('role_pipeline_stages')
      .insert({ id: stageId, role_id: role.id, name, position: nextPosition })

    if (insertError) {
      setPipelineStages((prev) => prev.filter((s) => s.id !== stageId))
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: originalStatus, custom_stage_id: originalCustomStageId } : a,
        ),
      )
      return
    }

    await changeStatus(applicationId, `custom:${stageId}`, { previousStatus: originalStatus, customStageName: name })
  }

  // stageName lets a caller that already knows the target stage's name
  // (submitNewStage, right after creating it) pass it through directly
  // instead of this looking it up in pipelineStages — that lookup would
  // otherwise run against a stale closure of pipelineStages captured
  // before the new stage's own setPipelineStages call had actually been
  // rendered (there's no await between the two calls), so the activity
  // log entry would fall back to the underlying status ("Reviewing")
  // and stay wrong until a reload re-read the correct label from the DB.
  // Returns whether the update actually succeeded — confirmRejection below
  // only fires the rejection email when it did, rather than unconditionally
  // (which would otherwise send a candidate a "you weren't selected" email
  // for a status change that never actually took effect).
  async function changeStatus(applicationId, rawValue, options = {}) {
    const application = applications.find((a) => a.id === applicationId)
    const previousStatus = options.previousStatus ?? application?.status
    const { status, customStageId } = parseStageValue(rawValue, role.id, pipelineStages)
    setUpdatingId(applicationId)
    setStatusError('')
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
      const candidateId = application?.candidate_profiles?.id
      if (candidateId) {
        const stageLabel = customStageId
          ? options.customStageName || pipelineStages.find((s) => s.id === customStageId)?.name || STATUS_LABELS[status]
          : STATUS_LABELS[status]
        prependActivity(candidateId, { event_type: 'status_changed', detail: stageLabel })
      }
      const shortlistChange = await syncShortlist(candidateId, status, previousStatus)
      if (candidateId && shortlistChange) {
        prependActivity(candidateId, { event_type: shortlistChange })
      }
    } else {
      setStatusError("Could not update that applicant's status — please try again.")
    }
    setUpdatingId(null)
    return !updateError
  }

  // A deleted stage's candidates land on whichever neighboring stage
  // ManageStagesModal picked as the destination (it also already moved them
  // there in the DB) — this mirrors that into local state and, since the
  // destination might be the builtin Shortlisted stage (or the candidate
  // might be leaving it), runs the same shortlist-table sync a normal
  // status change would.
  function handleStageDeleted(stageId, destination) {
    const destStatus = statusForStage(destination, role.id)
    const affected = applications.filter((a) => a.custom_stage_id === stageId)
    setApplications((prev) =>
      prev.map((a) => (a.custom_stage_id === stageId ? { ...a, status: destStatus, custom_stage_id: destination.id } : a)),
    )
    affected.forEach((a) => {
      const candidateId = a.candidate_profiles?.id
      if (!candidateId) return
      prependActivity(candidateId, { event_type: 'status_changed', detail: destination.name })
      syncShortlist(candidateId, destStatus, a.status).then((change) => {
        if (change) prependActivity(candidateId, { event_type: change })
      })
    })
  }

  function handleStatusSelect(applicationId, rawValue) {
    const { status } = parseStageValue(rawValue, role.id, pipelineStages)
    if (status === 'rejected') {
      setPendingRejectionId(applicationId)
      return
    }
    setPendingRejectionId(null)
    changeStatus(applicationId, rawValue)
  }

  async function confirmRejection(applicationId, shouldNotify) {
    const succeeded = await changeStatus(applicationId, 'rejected')
    if (succeeded && shouldNotify) {
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

  return (
    <div className="section">
      <Link to="/employer/roles" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
        ← Manage roles
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <h1 style={{ fontSize: 28 }}>Applicants for {role.title}</h1>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setShowManageStages(true)}>
          Manage stages
        </button>
      </div>

      <RoleAnalyticsPanel role={role} applications={applications} hires={hires} />

      {statusError && <p className="form-error" style={{ marginTop: 12 }}>{statusError}</p>}

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
                const badgeColors = customStage ? stageBadgeColor(customStage, role.id) : STATUS_COLORS[a.status]
                const candidateNotes = notesByCandidate[c.id] || []
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
                        {addingStageId === a.id ? (
                          <input
                            autoFocus
                            className="input"
                            placeholder="New stage name…"
                            value={newStageDraft}
                            onChange={(e) => setNewStageDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                submitNewStage(a.id)
                              } else if (e.key === 'Escape') {
                                setAddingStageId(null)
                                setNewStageDraft('')
                              }
                            }}
                            onBlur={() => submitNewStage(a.id)}
                            style={{ width: 160, padding: '8px 12px' }}
                          />
                        ) : (
                          <select
                            className="input"
                            value={pendingRejectionId === a.id ? 'rejected' : stageValueFor(a)}
                            disabled={updatingId === a.id}
                            onChange={(e) => {
                              if (e.target.value === ADD_CUSTOM_STAGE_VALUE) {
                                setAddingStageId(a.id)
                                setNewStageDraft('')
                                return
                              }
                              handleStatusSelect(a.id, e.target.value)
                            }}
                            style={{ width: 'auto', padding: '8px 12px' }}
                          >
                            <option value="applied">{STATUS_LABELS.applied}</option>
                            {[...pipelineStages]
                              .sort((s1, s2) => s1.position - s2.position)
                              .map((s) => (
                                <option key={s.id} value={`custom:${s.id}`}>
                                  {s.name}
                                </option>
                              ))}
                            <option value="rejected">{STATUS_LABELS.rejected}</option>
                            <option value={ADD_CUSTOM_STAGE_VALUE}>+ Add custom stage</option>
                          </select>
                        )}
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
                        {notesOpen ? 'Hide notes' : `Notes${candidateNotes.length > 0 ? ` (${candidateNotes.length})` : ''}`}
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
                        <CandidateNotesThread
                          employerId={role.employer_id}
                          candidateId={c.id}
                          roleId={role.id}
                          userId={user.id}
                          userEmail={user.email}
                          notes={candidateNotes}
                          onPosted={(posted) => {
                            setNotesByCandidate((prev) => ({ ...prev, [c.id]: [posted, ...(prev[c.id] || [])] }))
                            prependActivity(c.id, {
                              event_type: 'note_added',
                              detail: `${posted.author_email}: ${posted.body.slice(0, 120)}`,
                            })
                          }}
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
          onSent={(message) => {
            setMessageSent(true)
            setTimeout(() => setMessageSent(false), 3000)
            const candidateId = messagingApplication?.candidate_profiles?.id
            if (candidateId) {
              prependActivity(candidateId, { event_type: 'message_sent', detail: (message?.body || '').slice(0, 140) })
            }
          }}
        />
      )}

      {showManageStages && (
        <ManageStagesModal
          roleId={role.id}
          stages={pipelineStages}
          applications={applications}
          onClose={() => setShowManageStages(false)}
          onStagesUpdated={setPipelineStages}
          onStageDeleted={handleStageDeleted}
        />
      )}
    </div>
  )
}
