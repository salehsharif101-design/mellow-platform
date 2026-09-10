import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { notify } from '../../lib/notify.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import QuickMessageModal from '../../components/QuickMessageModal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'
import MessageIconButton from '../../components/MessageIconButton.jsx'
import BookMeetingButton from '../../components/BookMeetingButton.jsx'
import ShareButton from '../../components/ShareButton.jsx'
import IconButton from '../../components/IconButton.jsx'
import AskQuestionModal from '../../components/AskQuestionModal.jsx'
import { ensureBuiltinStages, statusForStage } from '../../lib/pipelineStages.js'
import { getAskQuestionAvailability } from '../../lib/videoQuestions.js'

const STATUSES = ['reviewing', 'shortlisted', 'rejected']
const STATUS_LABELS = { reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }
const SECTION_TITLE_STYLE = { fontSize: 20, marginBottom: 16 }

// The shortlists table only ever tracks the coarse reviewing/shortlisted/
// rejected status — the actual stage assignment (built-in or a
// employer-added custom one) lives on the matching application row, same
// as RoleApplicants.jsx. custom_stage_id is merged onto each entry
// client-side in load() below from that application, purely for display
// and for round-tripping back through parseStageValue on save.
function stageValueFor(entry) {
  return entry.custom_stage_id ? `custom:${entry.custom_stage_id}` : entry.status
}

function parseStageValue(rawValue, roleId, stages) {
  if (rawValue.startsWith('custom:')) {
    const id = rawValue.slice(7)
    const stage = stages.find((s) => s.id === id) || { id }
    return { status: statusForStage(stage, roleId), customStageId: id }
  }
  return { status: rawValue, customStageId: null }
}

const CANDIDATE_SELECT =
  'id, user_id, username, full_name, job_title, current_company, location, bio, headline, proud_of, skills, languages, availability, work_style, years_of_experience, intro_video_url, avatar_url, education_level, field_of_study, institution_name, graduation_year, linkedin_url, calendly_url, website_url'

export default function ShortlistReview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleParam = searchParams.get('role')

  const [employerId, setEmployerId] = useState(null)
  const [roleTitle, setRoleTitle] = useState(null)
  const [entries, setEntries] = useState([])
  const [pipelineStages, setPipelineStages] = useState([])
  const [workVideosByCandidate, setWorkVideosByCandidate] = useState({})
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [showCalendly, setShowCalendly] = useState(false)
  const [pendingRejection, setPendingRejection] = useState(false)
  const [questionsByCandidate, setQuestionsByCandidate] = useState({})
  const [showAskQuestion, setShowAskQuestion] = useState(false)

  useEffect(() => {
    if (!user || !roleParam) return

    async function load() {
      const { employerId: resolvedId } = await resolveEmployerId(user.id)
      if (!resolvedId) {
        setLoading(false)
        return
      }
      setEmployerId(resolvedId)

      let query = supabase
        .from('shortlists')
        .select(`id, candidate_id, role_id, status, roles(title), candidate_profiles(${CANDIDATE_SELECT})`)
        .eq('employer_id', resolvedId)
        .order('created_at', { ascending: false })
      query = roleParam === 'general' ? query.is('role_id', null) : query.eq('role_id', roleParam)

      const { data, error: shortlistError } = await query

      if (shortlistError) {
        setError(shortlistError.message)
        setLoading(false)
        return
      }

      const candidateIds = (data || []).map((e) => e.candidate_id)

      // Role-scoped review only — a "general" shortlist (from the Talent
      // Feed, not tied to a role) has no pipeline stages to speak of.
      let stages = []
      let entriesWithStage = data || []
      let questionsByCandidateId = {}
      if (roleParam !== 'general' && candidateIds.length > 0) {
        const [{ data: stagesData }, { data: apps }, { data: questions }] = await Promise.all([
          supabase
            .from('role_pipeline_stages')
            .select('id, name, position')
            .eq('role_id', roleParam)
            .order('position', { ascending: true }),
          supabase.from('applications').select('candidate_id, custom_stage_id').eq('role_id', roleParam).in('candidate_id', candidateIds),
          supabase.from('video_questions').select('candidate_id, status, asked_at').eq('role_id', roleParam),
        ])
        stages = await ensureBuiltinStages(supabase, roleParam, stagesData || [])
        const stageByCandidate = {}
        ;(apps || []).forEach((a) => {
          stageByCandidate[a.candidate_id] = a.custom_stage_id
        })
        entriesWithStage = (data || []).map((e) => ({ ...e, custom_stage_id: stageByCandidate[e.candidate_id] ?? null }))
        ;(questions || []).forEach((q) => {
          if (!questionsByCandidateId[q.candidate_id]) questionsByCandidateId[q.candidate_id] = []
          questionsByCandidateId[q.candidate_id].push(q)
        })
      }
      setPipelineStages(stages)
      setEntries(entriesWithStage)
      setQuestionsByCandidate(questionsByCandidateId)
      setRoleTitle(roleParam === 'general' ? null : data?.[0]?.roles?.title || null)

      if (candidateIds.length > 0) {
        const { data: videos } = await supabase
          .from('candidate_videos')
          .select('id, candidate_id, label, video_url, description')
          .in('candidate_id', candidateIds)
        const byCandidate = {}
        ;(videos || []).forEach((v) => {
          if (!byCandidate[v.candidate_id]) byCandidate[v.candidate_id] = []
          byCandidate[v.candidate_id].push(v)
        })
        setWorkVideosByCandidate(byCandidate)
      }

      setLoading(false)
    }

    setLoading(true)
    setIndex(0)
    load()
  }, [user, roleParam])

  useEffect(() => {
    if (!roleParam || (!loading && (!employerId || entries.length === 0))) {
      navigate('/employer/shortlist')
    }
  }, [roleParam, loading, employerId, entries, navigate])

  // A message composed (or a Calendly link opened) for one candidate
  // shouldn't carry over to whichever candidate the reviewer has since
  // navigated to — reset both open-modal flags on every index change.
  useEffect(() => {
    setShowMessage(false)
    setShowCalendly(false)
    setShowAskQuestion(false)
    setMessageSent(false)
  }, [index])

  // Returns whether the update actually succeeded — confirmRejection below
  // only fires the rejection email when it did, rather than unconditionally
  // (which would otherwise send a candidate a "you weren't selected" email
  // for a status change that never actually took effect). Writes the
  // application's status/custom_stage_id unconditionally (not just when
  // the coarse status changes) — two different custom stages can share the
  // same underlying status (both 'reviewing'), so gating on that would
  // silently drop a move between them.
  async function changeStatus(rawValue) {
    const entry = entries[index]
    if (!entry) return false
    const { status, customStageId } = parseStageValue(rawValue, entry.role_id, pipelineStages)
    setUpdating(true)
    const { data, error: updateError } = await supabase
      .from('shortlists')
      .update({ status })
      .eq('id', entry.id)
      .select()
      .single()
    if (!updateError) {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, status: data.status, custom_stage_id: customStageId } : e)),
      )
      if (entry.role_id) {
        // Otherwise the matching application (if any) keeps reading as its
        // old stage forever, which is what fed a stale count into the role
        // pipeline cards on the dashboard.
        await supabase
          .from('applications')
          .update({ status, custom_stage_id: customStageId })
          .eq('role_id', entry.role_id)
          .eq('candidate_id', entry.candidate_id)
      }
    }
    setUpdating(false)
    return !updateError
  }

  function handleStatusSelect(rawValue) {
    const entry = entries[index]
    const { status } = parseStageValue(rawValue, entry?.role_id, pipelineStages)
    if (status === 'rejected') {
      setPendingRejection(true)
      return
    }
    setPendingRejection(false)
    changeStatus(rawValue)
  }

  // Mirrors RoleApplicants.jsx's confirmRejection — rejects either way, and
  // only fires the notification email on "Yes". Since this page's entries
  // are shortlists rows (not applications), only entries tied to a role
  // have a matching application to notify about — a candidate shortlisted
  // generally from the Talent Feed has none, so "Yes" is a no-op for those.
  async function confirmRejection(shouldNotify) {
    const entry = entries[index]
    const succeeded = await changeStatus('rejected')
    if (succeeded && shouldNotify && entry?.role_id) {
      const { data: application } = await supabase
        .from('applications')
        .select('id')
        .eq('role_id', entry.role_id)
        .eq('candidate_id', entry.candidate_id)
        .maybeSingle()
      if (application) {
        notify('rejection-notification', { applicationId: application.id })
      }
    }
    setPendingRejection(false)
  }

  if (loading) return null

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  if (!employerId || entries.length === 0) {
    return null
  }

  const entry = entries[index]
  const c = entry.candidate_profiles
  const workVideos = workVideosByCandidate[entry.candidate_id] || []

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 900, overflowY: 'auto' }}>
      <div className="shortlist-review-topbar">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {roleTitle || 'Not tied to a role'} · {index + 1} of {entries.length}
        </p>
        <button type="button" onClick={() => navigate('/employer/shortlist')} aria-label="Exit review mode" className="icon-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="shortlist-review-layout">
        {entries.length > 1 && (
          <aside className="shortlist-review-sidebar">
            {entries.map((e, i) => {
              const ec = e.candidate_profiles
              if (!ec) return null
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`shortlist-strip-item${i === index ? ' active' : ''}`}
                  onClick={() => {
                    setPendingRejection(false)
                    setIndex(i)
                  }}
                >
                  <CandidateAvatar avatarUrl={ec.avatar_url} fullName={ec.full_name} size={40} />
                  <span>{ec.full_name}</span>
                </button>
              )
            })}
          </aside>
        )}

        <div className="shortlist-review-content">
          <div className="profile-card">
            <div className="profile-hero-body">
              <div className="profile-hero-info">
                <div className="profile-hero-avatar-row">
                  <Link to={`/profile/${c.username || c.id}`} style={{ flexShrink: 0 }}>
                    <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={96} style={{ fontSize: 32 }} />
                  </Link>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="profile-name-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: 28 }}>{c.full_name}</h1>
                        <CompanyLinkIcons linkedinUrl={c.linkedin_url} websiteUrl={c.website_url} label={c.full_name} size={19} />
                        <MessageIconButton onMessage={() => setShowMessage(true)} label={c.full_name} size={19} />
                        {entry.role_id &&
                          (() => {
                            const { canAsk, reason } = getAskQuestionAvailability(questionsByCandidate[entry.candidate_id] || [])
                            return (
                              <IconButton
                                icon={
                                  <>
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                  </>
                                }
                                label={
                                  reason ||
                                  'Ask a question — send a video question to this candidate and receive their recorded answer. Limit 2 questions per candidate.'
                                }
                                disabled={!canAsk}
                                onClick={() => setShowAskQuestion(true)}
                                size={19}
                              />
                            )
                          })()}
                        <ShareButton url={`${window.location.origin}/profile/${c.username || c.id}`} label="Share profile" size={19} />
                      </div>
                      {c.calendly_url && <BookMeetingButton onClick={() => setShowCalendly(true)} />}
                    </div>
                    <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>
                      {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                      {c.location && ` · ${c.location}`}
                      {c.years_of_experience && ` · ${c.years_of_experience}`}
                    </p>

                    {c.headline && (
                      <p style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>
                        {c.headline}
                      </p>
                    )}

                    {(c.availability || c.work_style?.length > 0) && (
                      <div className="profile-tag-row" style={{ marginTop: 12 }}>
                        {c.availability && (
                          <span className="tag" style={{ fontSize: 12, fontWeight: 600, background: '#e3f9e9', color: '#0f7a3d' }}>
                            Available: {c.availability}
                          </span>
                        )}
                        {c.work_style?.map((w) => (
                          <span key={w} className="tag" style={{ fontSize: 12 }}>
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
              {c.intro_video_url ? (
                <VideoPlayCard url={c.intro_video_url} format="auto" style={{ width: '100%' }} />
              ) : (
                <div
                  style={{
                    borderRadius: 10,
                    background: 'var(--color-bg-soft)',
                    aspectRatio: '9 / 16',
                    width: '100%',
                    maxWidth: 320,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                    fontSize: 14,
                    textAlign: 'center',
                    padding: 16,
                  }}
                >
                  No intro video yet
                </div>
              )}
            </div>

            {workVideos.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <h2 style={SECTION_TITLE_STYLE}>Watch me work</h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 16,
                    marginTop: 16,
                  }}
                >
                  {workVideos.map((v) => (
                    <div key={v.id}>
                      <VideoPlayCard url={v.video_url} format="horizontal" />
                      <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{v.label}</p>
                      {v.description && (
                        <p style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>{v.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {c.bio && (
              <div style={{ marginTop: 48 }}>
                <h2 style={SECTION_TITLE_STYLE}>About</h2>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-text)' }}>{c.bio}</p>
              </div>
            )}

            {c.skills?.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <h2 style={SECTION_TITLE_STYLE}>Skills</h2>
                <div className="profile-tag-row">
                  {c.skills.map((s) => (
                    <span key={s} className="tag">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {c.languages?.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <h2 style={SECTION_TITLE_STYLE}>Languages</h2>
                <div className="profile-tag-row">
                  {c.languages.map((l) => (
                    <span key={l.language} className="tag">
                      {l.language} · {l.proficiency}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {c.proud_of && (
              <div style={{ marginTop: 48 }}>
                <h2 style={SECTION_TITLE_STYLE}>What I'm most proud of</h2>
                <blockquote
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    borderLeft: '3px solid var(--color-primary)',
                    fontSize: 16,
                    lineHeight: 1.7,
                    fontStyle: 'italic',
                    color: 'var(--color-text)',
                  }}
                >
                  “{c.proud_of}”
                </blockquote>
              </div>
            )}

            {(c.education_level || c.field_of_study || c.institution_name || c.graduation_year) && (
              <div style={{ marginTop: 48 }}>
                <h2 style={SECTION_TITLE_STYLE}>Education</h2>
                {(c.education_level || c.field_of_study) && (
                  <p style={{ fontSize: 16 }}>{[c.education_level, c.field_of_study].filter(Boolean).join(' in ')}</p>
                )}
                {(c.institution_name || c.graduation_year) && (
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {[c.institution_name, c.graduation_year].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {messageSent && <p style={{ marginTop: 24, fontSize: 14, fontWeight: 600, color: '#0f7a3d' }}>Message sent</p>}
        </div>
      </div>

      {pendingRejection && (
        <div style={{ position: 'fixed', bottom: 68, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 901 }}>
          <div
            className="card"
            style={{ padding: '14px 18px', background: 'var(--color-bg-soft)', border: 'none', maxWidth: 420, margin: '0 24px' }}
          >
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              Would you like to notify them that you have decided to move forward with other talent?
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" disabled={updating} onClick={() => confirmRejection(true)}>
                Yes, send email
              </button>
              <button type="button" className="btn btn-ghost" disabled={updating} onClick={() => confirmRejection(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="shortlist-review-bottombar">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={index === 0}
          onClick={() => {
            setPendingRejection(false)
            setIndex((i) => Math.max(0, i - 1))
          }}
        >
          ← Previous
        </button>
        <select
          className="input"
          value={pendingRejection ? 'rejected' : stageValueFor(entry)}
          disabled={updating}
          onChange={(e) => handleStatusSelect(e.target.value)}
          style={{ width: 'auto', padding: '8px 12px' }}
        >
          {pipelineStages.length > 0 ? (
            <>
              {[...pipelineStages]
                .sort((s1, s2) => s1.position - s2.position)
                .map((s) => (
                  <option key={s.id} value={`custom:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              <option value="rejected">Rejected</option>
            </>
          ) : (
            STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={index === entries.length - 1}
          onClick={() => {
            setPendingRejection(false)
            setIndex((i) => Math.min(entries.length - 1, i + 1))
          }}
        >
          Next →
        </button>
      </div>

      {showCalendly && c.calendly_url && <CalendlyModal calendlyUrl={c.calendly_url} onClose={() => setShowCalendly(false)} />}

      {showMessage && (
        <QuickMessageModal
          recipientUserId={c.user_id}
          recipientLabel={c.full_name}
          onClose={() => setShowMessage(false)}
          onSent={() => {
            setMessageSent(true)
            setTimeout(() => setMessageSent(false), 3000)
          }}
        />
      )}

      {showAskQuestion && entry.role_id && (
        <AskQuestionModal
          employerId={employerId}
          candidateId={entry.candidate_id}
          roleId={entry.role_id}
          candidateLabel={c.full_name}
          questionNumber={(questionsByCandidate[entry.candidate_id] || []).length + 1}
          onClose={() => setShowAskQuestion(false)}
          onSent={(question) => {
            setQuestionsByCandidate((prev) => ({
              ...prev,
              [question.candidate_id]: [...(prev[question.candidate_id] || []), question],
            }))
          }}
        />
      )}
    </div>
  )
}
