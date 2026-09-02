import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { calculateMatchScore } from '../../lib/matchScore.js'
import EmptyState from '../../components/EmptyState.jsx'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import CandidateProfileContent from '../../components/CandidateProfileContent.jsx'
import QuickMessageModal from '../../components/QuickMessageModal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import { syncApplicationStatus } from '../../lib/shortlistSync.js'

const CANDIDATE_SELECT =
  'id, user_id, username, full_name, job_title, current_company, location, bio, headline, proud_of, skills, languages, availability, work_style, years_of_experience, intro_video_url, avatar_url, education_level, field_of_study, institution_name, graduation_year, linkedin_url, calendly_url, website_url'

// Same breakpoint the rest of the app uses for its mobile overrides (see
// components.css) — read via matchMedia (reactive to resize/orientation)
// rather than a one-off width check, since desktop and mobile here are two
// genuinely different interactions (click-to-select-inline vs. tap-to-
// navigate), not just a CSS reflow.
const DESKTOP_QUERY = '(min-width: 769px)'

function isDesktopViewport() {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
}

export default function Shortlist() {
  const { user } = useAuth()
  const [employerId, setEmployerId] = useState(null)
  const [entries, setEntries] = useState([])
  const [workVideosByCandidate, setWorkVideosByCandidate] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [selectedEntryId, setSelectedEntryId] = useState(null)
  const [isDesktop, setIsDesktop] = useState(isDesktopViewport)
  const [showMessage, setShowMessage] = useState(false)
  const [showCalendly, setShowCalendly] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const onChange = (e) => setIsDesktop(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!user) return

    async function load() {
      const { employerId: resolvedId } = await resolveEmployerId(user.id)
      if (!resolvedId) {
        setLoading(false)
        return
      }
      setEmployerId(resolvedId)

      const { data, error: shortlistError } = await supabase
        .from('shortlists')
        .select(
          `id, candidate_id, role_id, status, roles(id, title, required_skills, role_type), candidate_profiles(${CANDIDATE_SELECT})`,
        )
        .eq('employer_id', resolvedId)
        .order('created_at', { ascending: false })

      if (shortlistError) {
        setError(shortlistError.message)
        setLoading(false)
        return
      }
      setEntries(data || [])

      const candidateIds = (data || []).map((e) => e.candidate_id)
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

    load()
  }, [user])

  async function remove(shortlistId) {
    const entry = entries.find((e) => e.id === shortlistId)
    setRemovingId(shortlistId)
    const { error: removeError } = await supabase.from('shortlists').delete().eq('id', shortlistId)
    if (!removeError) {
      setEntries((prev) => prev.filter((e) => e.id !== shortlistId))
      setSelectedEntryId((prev) => (prev === shortlistId ? null : prev))
      // Otherwise the matching application (if any) keeps reading as
      // "shortlisted" forever, which is what fed a stale count into the
      // role pipeline cards on the dashboard.
      await syncApplicationStatus(entry?.role_id, entry?.candidate_id, 'reviewing')
    }
    setRemovingId(null)
  }

  if (loading) return null

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  // Grouped only to drive one "Review candidates" swipe-mode link per role
  // (that flow is still per-role) — the candidate list itself stays flat,
  // not sectioned, per the new layout.
  const groups = []
  const groupByKey = new Map()
  entries.forEach((entry) => {
    const key = entry.role_id || 'general'
    let group = groupByKey.get(key)
    if (!group) {
      group = { key, title: entry.roles?.title || null, count: 0 }
      groupByKey.set(key, group)
      groups.push(group)
    }
    group.count += 1
  })

  const reviewLinks = groups.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {groups.map((g) => (
        <Link
          key={g.key}
          to={`/employer/shortlist/review?role=${g.key}`}
          className="btn btn-ghost"
          style={{ fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          Review {g.title || 'general'} ({g.count})
        </Link>
      ))}
    </div>
  )

  if (entries.length === 0) {
    return (
      <div className="section">
        <h1 style={{ fontSize: 28 }}>Shortlisted talent</h1>
        <EmptyState
          heading="No shortlisted talent yet"
          body="Browse the talent feed and click Shortlist on any talent you want to save here."
          illustration="/Flexible.PNG"
        />
        <p style={{ textAlign: 'center', marginTop: -20 }}>
          <Link to="/employer/talent" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
            Browse talent →
          </Link>
        </p>
      </div>
    )
  }

  // ---- Mobile: full-width compact cards, tap navigates to the real
  // public profile page rather than opening anything inline. ----
  if (!isDesktop) {
    return (
      <div className="section">
        <h1 style={{ fontSize: 28 }}>Shortlisted talent</h1>
        {reviewLinks && <div style={{ marginTop: 16 }}>{reviewLinks}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {entries.map((entry) => {
            const c = entry.candidate_profiles
            if (!c) return null
            const score = entry.roles ? calculateMatchScore(c, entry.roles) : null
            return (
              <Link
                key={entry.id}
                to={`/profile/${c.username || c.id}`}
                state={{ from: 'shortlist' }}
                className="card stat-card-link"
                style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={48} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{c.full_name}</p>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {c.availability && (
                      <span className="tag" style={{ fontSize: 11, padding: '2px 8px', background: '#e3f9e9', color: '#0f7a3d' }}>
                        {c.availability}
                      </span>
                    )}
                    {score !== null && (
                      <span className="tag" style={{ fontSize: 11, padding: '2px 8px', background: 'var(--color-primary)', color: '#fff' }}>
                        {score}% match
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- Desktop: two-panel layout ----
  const selectedEntry = entries.find((e) => e.id === selectedEntryId) || null
  const selectedCandidate = selectedEntry?.candidate_profiles || null

  return (
    <div className="section" style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Shortlisted talent</h1>
        {reviewLinks}
      </div>

      <div className="shortlist-split-layout">
        <div className="shortlist-split-list">
          {entries.map((entry) => {
            const c = entry.candidate_profiles
            if (!c) return null
            const score = entry.roles ? calculateMatchScore(c, entry.roles) : null
            const active = entry.id === selectedEntryId
            return (
              <button
                key={entry.id}
                type="button"
                className={`shortlist-split-item${active ? ' active' : ''}`}
                onClick={() => setSelectedEntryId(entry.id)}
              >
                <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {c.full_name}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.job_title}
                  </p>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {c.availability && (
                      <span className="tag" style={{ fontSize: 10, padding: '1px 6px', background: '#e3f9e9', color: '#0f7a3d' }}>
                        {c.availability}
                      </span>
                    )}
                    {score !== null && (
                      <span className="tag" style={{ fontSize: 10, padding: '1px 6px', background: 'var(--color-primary)', color: '#fff' }}>
                        {score}%
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="shortlist-split-detail">
          {!selectedCandidate ? (
            <EmptyState heading="Select a candidate to view their profile" body="" illustration="/Collaborate2.png" />
          ) : (
            <>
              <div className="shortlist-detail-actions">
                <button type="button" className="btn btn-primary" onClick={() => setShowMessage(true)}>
                  Message
                </button>
                {selectedCandidate.calendly_url && (
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCalendly(true)}>
                    Book a meeting
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={removingId === selectedEntry.id}
                  onClick={() => remove(selectedEntry.id)}
                >
                  {removingId === selectedEntry.id ? 'Removing…' : 'Remove from shortlist'}
                </button>
              </div>
              <CandidateProfileContent profile={selectedCandidate} videos={workVideosByCandidate[selectedCandidate.id] || []} />
            </>
          )}
        </div>
      </div>

      {showMessage && selectedCandidate && (
        <QuickMessageModal
          recipientUserId={selectedCandidate.user_id}
          recipientLabel={selectedCandidate.full_name}
          onClose={() => setShowMessage(false)}
        />
      )}

      {showCalendly && selectedCandidate?.calendly_url && (
        <CalendlyModal calendlyUrl={selectedCandidate.calendly_url} onClose={() => setShowCalendly(false)} />
      )}
    </div>
  )
}
