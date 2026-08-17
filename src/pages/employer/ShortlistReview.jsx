import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import QuickMessageModal from '../../components/QuickMessageModal.jsx'

const STATUSES = ['reviewing', 'shortlisted', 'rejected']
const STATUS_LABELS = { reviewing: 'Reviewing', shortlisted: 'Shortlisted', rejected: 'Rejected' }

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
        .select(
          'id, candidate_id, status, candidate_profiles(id, user_id, username, full_name, job_title, current_company, skills, availability, years_of_experience, intro_video_url, avatar_url, education_level, field_of_study, institution_name, graduation_year, linkedin_url, calendly_url, website_url)',
        )
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
  const education = [c.education_level, c.field_of_study, c.institution_name, c.graduation_year]
    .filter(Boolean)
    .join(' · ')

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 900, overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {index + 1} of {entries.length}
          </p>
          <button
            type="button"
            onClick={() => navigate('/employer/shortlist')}
            aria-label="Exit review mode"
            style={{ background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={64} />
          <div>
            <h1 style={{ fontSize: 24 }}>{c.full_name}</h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
              {c.years_of_experience && ` · ${c.years_of_experience}`}
            </p>
          </div>
        </div>

        {(c.skills?.length > 0 || c.availability) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {c.availability && (
              <span className="tag" style={{ background: '#e3f9e9', color: '#0f7a3d' }}>
                Available: {c.availability}
              </span>
            )}
            {c.skills?.map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </div>
        )}

        {c.intro_video_url && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Intro video</h3>
            <VideoPlayCard url={c.intro_video_url} />
          </div>
        )}

        {workVideos.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Work videos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {workVideos.map((v) => (
                <div key={v.id}>
                  <VideoPlayCard url={v.video_url} format="horizontal" />
                  <p style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>{v.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {education && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Education</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{education}</p>
          </div>
        )}

        {(c.linkedin_url || c.calendly_url || c.website_url) && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--color-primary)' }}>
                  LinkedIn →
                </a>
              )}
              {c.calendly_url && (
                <a href={c.calendly_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--color-primary)' }}>
                  Calendly →
                </a>
              )}
              {c.website_url && (
                <a href={c.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--color-primary)' }}>
                  Portfolio →
                </a>
              )}
            </div>
          </div>
        )}

        {messageSent && <p style={{ marginTop: 20, fontSize: 14, fontWeight: 600, color: '#0f7a3d' }}>Message sent</p>}

        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
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
          <button type="button" className="btn btn-ghost" onClick={() => setShowMessage(true)}>
            Message
          </button>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={index === entries.length - 1}
            onClick={() => setIndex((i) => Math.min(entries.length - 1, i + 1))}
          >
            Next →
          </button>
        </div>
      </div>

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
