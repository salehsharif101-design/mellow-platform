import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { getCandidateStatusLabel } from '../../lib/roleFormat.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import { ANSWER_WINDOW_DAYS, isPastDeadline } from '../../lib/videoQuestions.js'
import EmptyState from '../../components/EmptyState.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'
import CompanyAvatar from '../../components/CompanyAvatar.jsx'

const STATUS_LABEL_STYLES = {
  Applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  'Under review': { background: '#fff6e0', color: '#8a6100' },
  Shortlisted: { background: '#e3f9e9', color: '#0f7a3d' },
  'Not selected': { background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)' },
}

function StatusTag({ status }) {
  const label = getCandidateStatusLabel(status)
  const style = STATUS_LABEL_STYLES[label]
  return (
    <span className="tag" style={{ background: style.background, color: style.color }}>
      {label}
    </span>
  )
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const QUESTION_ORDINAL = ['a question', 'a second question']

// One video question can contribute up to three timeline steps — asked,
// (if answered) answered, (if expired instead) expired — built from the
// same effective-status logic as the employer side (RoleApplicants.jsx):
// a 'pending' row past its 3-day window reads as expired here too, rather
// than waiting on the daily cron to catch up before the candidate sees it.
function buildQuestionSteps(questions, companyName) {
  const steps = []
  questions
    .slice()
    .sort((a, b) => new Date(a.asked_at) - new Date(b.asked_at))
    .forEach((q, i) => {
      const effectiveStatus = q.status === 'pending' && isPastDeadline(q.asked_at) ? 'expired' : q.status
      steps.push({
        label: `${companyName} asked you ${QUESTION_ORDINAL[i] || `question ${i + 1}`}`,
        date: q.asked_at,
        link: effectiveStatus === 'pending' ? `/answer-question/${q.answer_token}` : null,
      })
      if (q.answered_at) {
        steps.push({ label: 'You answered their question', date: q.answered_at })
      } else if (effectiveStatus === 'expired') {
        steps.push({
          label: 'Question expired',
          date: q.expired_at || new Date(new Date(q.asked_at).getTime() + ANSWER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          muted: true,
        })
      }
    })
  return steps
}

// Only steps that have actually happened appear here — an unviewed
// profile or a status still sitting at "applied" simply isn't a step yet,
// rather than a step shown with a "Not yet" placeholder. Question steps are
// merged in and the whole list re-sorted chronologically rather than
// appended at the end, since a question can land between any two of the
// other events in real time.
function Timeline({ application, questions }) {
  const steps = [{ label: 'Applied', date: application.applied_at }]
  if (application.viewed_at) {
    steps.push({ label: 'Profile viewed by employer', date: application.viewed_at })
  }
  if (['reviewing', 'shortlisted', 'rejected'].includes(application.status) && application.status_changed_at) {
    steps.push({
      label: `Status update — ${getCandidateStatusLabel(application.status)}`,
      date: application.status_changed_at,
    })
  }
  const companyName = application.roles?.employer_profiles?.company_name || 'The employer'
  steps.push(...buildQuestionSteps(questions, companyName))
  steps.sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      {steps.map((step, i) => (
        <div key={`${step.label}-${step.date}`} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                flexShrink: 0,
                background: step.muted ? 'var(--color-border)' : 'var(--color-primary)',
              }}
            />
            {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--color-border)' }} />}
          </div>
          <div style={{ paddingBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: step.muted ? 'var(--color-text-muted)' : 'inherit' }}>
              {step.link ? (
                <Link to={step.link} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {step.label}
                </Link>
              ) : (
                step.label
              )}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{formatDate(step.date)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Applications() {
  const { user } = useAuth()

  const cacheKey = user ? `applications:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [applications, setApplications] = useState(cached?.applications ?? [])
  const [questionsByRole, setQuestionsByRole] = useState(cached?.questionsByRole ?? {})
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (candidateError) {
        setError(candidateError.message)
        setLoading(false)
        return
      }
      if (!candidate) {
        setLoading(false)
        return
      }

      const [{ data, error: appsError }, { data: questions }] = await Promise.all([
        supabase
          .from('applications')
          .select(
            'id, role_id, status, applied_at, viewed_at, status_changed_at, roles(title, slug, status, employer_profiles(company_name, logo_url, company_slug))',
          )
          .eq('candidate_id', candidate.id)
          .order('applied_at', { ascending: false }),
        supabase
          .from('video_questions')
          .select('id, role_id, question_text, asked_at, answered_at, expired_at, status, answer_token')
          .eq('candidate_id', candidate.id),
      ])

      if (appsError) {
        setError(appsError.message)
        setLoading(false)
        return
      }

      const questionsByRoleId = {}
      ;(questions || []).forEach((q) => {
        if (!questionsByRoleId[q.role_id]) questionsByRoleId[q.role_id] = []
        questionsByRoleId[q.role_id].push(q)
      })

      setApplications(data)
      setQuestionsByRole(questionsByRoleId)
      setLoading(false)

      if (cacheKey) setCachedPage(cacheKey, { applications: data, questionsByRole: questionsByRoleId })
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <ListPageSkeleton titleWidth={220} rows={4} />

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="section">
      <h1 style={{ fontSize: 28 }}>Your applications</h1>

      {applications.length === 0 ? (
        <>
          <EmptyState
            heading="No applications yet"
            body="Browse open roles and apply with one tap. Your applications will appear here."
            illustration="/Your_Requested_Is_Posted.png"
          />
          <p style={{ textAlign: 'center', marginTop: -20 }}>
            <Link to="/roles" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
              Browse open roles →
            </Link>
          </p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, maxWidth: 640 }}>
          {applications.map((a) => {
            const expanded = expandedIds.has(a.id)
            const employer = a.roles?.employer_profiles
            const avatar = <CompanyAvatar logoUrl={employer?.logo_url} companyName={employer?.company_name} size={40} />
            return (
              <div key={a.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {employer?.company_slug ? (
                      <Link to={`/company/${employer.company_slug}`} style={{ flexShrink: 0, lineHeight: 0 }}>
                        {avatar}
                      </Link>
                    ) : (
                      avatar
                    )}
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {a.roles?.slug ? (
                          <Link to={`/jobs/${a.roles.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {a.roles?.title}
                          </Link>
                        ) : (
                          a.roles?.title
                        )}
                        {a.roles?.status === 'paused' && (
                          <span className="tag" style={{ fontSize: 11, background: '#fff6e0', color: '#8a6100' }}>
                            Role paused
                          </span>
                        )}
                        {a.roles?.status === 'closed' && (
                          <span className="tag" style={{ fontSize: 11, background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)' }}>
                            Role closed
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {employer?.company_slug ? (
                          <Link to={`/company/${employer.company_slug}`} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'none' }}>
                            {employer.company_name}
                          </Link>
                        ) : (
                          employer?.company_name
                        )}{' '}
                        · Applied {formatDate(a.applied_at)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <StatusTag status={a.status} />
                    <button
                      type="button"
                      onClick={() => toggleExpanded(a.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      {expanded ? 'Hide timeline' : 'View timeline'}
                    </button>
                  </div>
                </div>
                {expanded && <Timeline application={a} questions={questionsByRole[a.role_id] || []} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
