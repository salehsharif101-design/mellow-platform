import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import QuickMessageModal from '../../components/QuickMessageModal.jsx'
import CalendlyModal from '../../components/CalendlyModal.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'
import ShareButton from '../../components/ShareButton.jsx'

const STATUSES = ['reviewing', 'shortlisted', 'rejected']
const STATUS_LABELS = { reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }
const SECTION_TITLE_STYLE = {
  fontSize: 20,
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: '1px solid var(--color-border)',
}

const CANDIDATE_SELECT =
  'id, user_id, username, full_name, job_title, current_company, location, bio, three_words, proud_of, skills, languages, availability, work_style, years_of_experience, intro_video_url, avatar_url, education_level, field_of_study, institution_name, graduation_year, linkedin_url, calendly_url, website_url'

export default function ShortlistReview() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [employerId, setEmployerId] = useState(null)
  const [entries, setEntries] = useState([])
  const [workVideosByCandidate, setWorkVideosByCandidate] = useState({})
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [showCalendly, setShowCalendly] = useState(false)

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
      setEmployerId(employer.id)

      const { data, error: shortlistError } = await supabase
        .from('shortlists')
        .select(`id, candidate_id, status, candidate_profiles(${CANDIDATE_SELECT})`)
        .eq('employer_id', employer.id)
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

  useEffect(() => {
    if (!loading && (!employerId || entries.length === 0)) {
      navigate('/employer/shortlist')
    }
  }, [loading, employerId, entries, navigate])

  async function changeStatus(status) {
    const entry = entries[index]
    if (!entry) return
    setUpdating(true)
    const { data, error: updateError } = await supabase
      .from('shortlists')
      .update({ status })
      .eq('id', entry.id)
      .select()
      .single()
    if (!updateError) {
      setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status: data.status } : e)))
    }
    setUpdating(false)
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
  const knownFor = (c.three_words || '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 900, overflowY: 'auto' }}>
      <div className="shortlist-review-topbar">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {index + 1} of {entries.length}
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
                  onClick={() => setIndex(i)}
                >
                  <CandidateAvatar avatarUrl={ec.avatar_url} fullName={ec.full_name} size={40} />
                  <span>{ec.full_name}</span>
                </button>
              )
            })}
          </aside>
        )}

        <div className="shortlist-review-content">
          <div className="profile-hero-actions">
            {c.calendly_url && (
              <button className="btn btn-primary" onClick={() => setShowCalendly(true)}>
                Book a meeting
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowMessage(true)}>
              Message
            </button>
          </div>

          <div className="profile-hero-body">
            <div className="profile-hero-info">
              <div className="profile-hero-avatar-row">
                <Link to={`/profile/${c.username || c.id}`} style={{ flexShrink: 0 }}>
                  <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={96} style={{ fontSize: 32 }} />
                </Link>
                <div style={{ minWidth: 0 }}>
                  <div className="profile-name-row">
                    <h1 style={{ fontSize: 28 }}>{c.full_name}</h1>
                    <CompanyLinkIcons linkedinUrl={c.linkedin_url} websiteUrl={c.website_url} label={c.full_name} size={19} />
                    <ShareButton url={`https://beta.joinmellow.xyz/profile/${c.username || c.id}`} label="Share profile" />
                  </div>
                  <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>
                    {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                    {c.location && ` · ${c.location}`}
                    {c.years_of_experience && ` · ${c.years_of_experience}`}
                  </p>

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

                  {knownFor.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Known for
                      </p>
                      <div className="profile-tag-row" style={{ marginTop: 8 }}>
                        {knownFor.map((word) => (
                          <span key={word} className="tag" style={{ background: 'var(--color-bg-soft)', color: 'var(--color-primary)', fontWeight: 700 }}>
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 320 }}>
              {c.intro_video_url ? (
                <VideoPlayCard url={c.intro_video_url} style={{ width: '100%' }} />
              ) : (
                <div
                  style={{
                    borderRadius: 10,
                    background: 'var(--color-bg-soft)',
                    aspectRatio: '9 / 16',
                    width: '100%',
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
          </div>

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

          {workVideos.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <h2 style={SECTION_TITLE_STYLE}>How {c.full_name?.split(' ')[0]} actually works</h2>
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

          {messageSent && <p style={{ marginTop: 24, fontSize: 14, fontWeight: 600, color: '#0f7a3d' }}>Message sent</p>}
        </div>
      </div>

      <div className="shortlist-review-bottombar">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          ← Previous
        </button>
        <select
          className="input"
          value={entry.status}
          disabled={updating}
          onChange={(e) => changeStatus(e.target.value)}
          style={{ width: 'auto', padding: '8px 12px' }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={index === entries.length - 1}
          onClick={() => setIndex((i) => Math.min(entries.length - 1, i + 1))}
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
    </div>
  )
}
