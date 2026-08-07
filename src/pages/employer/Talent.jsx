import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import EmptyState from '../../components/EmptyState.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'

const AVAILABILITY_OPTIONS = ['Immediately', 'Within a month', '1 to 3 months', 'Just exploring']
const WORK_STYLE_OPTIONS = ['Remote', 'Hybrid', 'On-site']

export default function TalentFeed() {
  const { user } = useAuth()

  const [employerId, setEmployerId] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [shortlistedIds, setShortlistedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [locationFilter, setLocationFilter] = useState('')
  const [activeSkills, setActiveSkills] = useState(new Set())
  const [activeAvailability, setActiveAvailability] = useState(new Set())
  const [activeWorkStyle, setActiveWorkStyle] = useState(new Set())

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
        setError('Finish setting up your company profile before browsing talent.')
        setLoading(false)
        return
      }
      setEmployerId(employer.id)

      const [{ data: liveCandidates, error: candidatesError }, { data: shortlists, error: shortlistError }] =
        await Promise.all([
          supabase
            .from('candidate_profiles')
            .select(
              'id, username, full_name, job_title, current_company, location, skills, availability, work_style, intro_video_url',
            )
            .eq('is_live', true)
            .eq('is_open_to_opportunities', true)
            .order('created_at', { ascending: false }),
          supabase.from('shortlists').select('candidate_id').eq('employer_id', employer.id),
        ])

      if (candidatesError) setError(candidatesError.message)
      else setCandidates(liveCandidates)

      if (!shortlistError) setShortlistedIds(new Set(shortlists.map((s) => s.candidate_id)))

      setLoading(false)
    }

    load()
  }, [user])

  const allSkills = useMemo(() => {
    const set = new Set()
    candidates.forEach((c) => c.skills.forEach((s) => set.add(s)))
    return Array.from(set).sort()
  }, [candidates])

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      const matchesLocation =
        !locationFilter.trim() || (c.location || '').toLowerCase().includes(locationFilter.trim().toLowerCase())
      const matchesSkills = activeSkills.size === 0 || c.skills.some((s) => activeSkills.has(s))
      const matchesAvailability = activeAvailability.size === 0 || activeAvailability.has(c.availability)
      const matchesWorkStyle = activeWorkStyle.size === 0 || (c.work_style || []).some((w) => activeWorkStyle.has(w))
      return matchesLocation && matchesSkills && matchesAvailability && matchesWorkStyle
    })
  }, [candidates, locationFilter, activeSkills, activeAvailability, activeWorkStyle])

  function toggleSkill(skill) {
    setActiveSkills((prev) => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      return next
    })
  }

  function toggleAvailability(option) {
    setActiveAvailability((prev) => {
      const next = new Set(prev)
      if (next.has(option)) next.delete(option)
      else next.add(option)
      return next
    })
  }

  function toggleWorkStyle(option) {
    setActiveWorkStyle((prev) => {
      const next = new Set(prev)
      if (next.has(option)) next.delete(option)
      else next.add(option)
      return next
    })
  }

  async function shortlist(candidateId) {
    if (!employerId) return
    setSavingId(candidateId)
    const { data, error: insertError } = await supabase
      .from('shortlists')
      .insert({ employer_id: employerId, candidate_id: candidateId })
      .select()
      .single()
    if (!insertError) {
      setShortlistedIds((prev) => new Set(prev).add(candidateId))
      notify('shortlist-notification', { shortlistId: data.id })
    }
    setSavingId(null)
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
      <h1 style={{ fontSize: 28 }}>Browse talent</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Filter by location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
          {allSkills.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>Availability:</span>
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleAvailability(option)}
              className="tag"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: activeAvailability.has(option) ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                color: activeAvailability.has(option) ? '#fff' : 'var(--color-primary)',
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>Work style:</span>
          {WORK_STYLE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleWorkStyle(option)}
              className="tag"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: activeWorkStyle.has(option) ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                color: activeWorkStyle.has(option) ? '#fff' : 'var(--color-primary)',
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {candidates.length === 0 ? (
        <EmptyState
          heading="No candidates yet"
          body="We are growing fast. Check back soon or share Mellow with people you know who are looking for opportunities."
          illustration="/Collaborate2.png"
        />
      ) : filtered.length === 0 ? (
        <p style={{ marginTop: 32, color: 'var(--color-text-muted)' }}>No candidates match those filters yet.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
            marginTop: 32,
          }}
        >
          {filtered.map((c) => (
            <div key={c.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {c.intro_video_url ? (
                <VideoPlayCard url={c.intro_video_url} />
              ) : (
                <div
                  style={{
                    aspectRatio: '9 / 16',
                    width: '100%',
                    maxWidth: 400,
                    margin: '0 auto',
                    background: 'var(--color-bg-soft)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                  }}
                >
                  No video yet
                </div>
              )}

              <div>
                <Link to={`/profile/${c.username || c.id}`} style={{ textDecoration: 'none' }}>
                  <h3 style={{ fontSize: 17 }}>{c.full_name}</h3>
                </Link>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title} · {c.location}
                </p>
                {c.availability && (
                  <span
                    className="tag"
                    style={{ marginTop: 6, display: 'inline-flex', fontSize: 12, background: 'var(--color-bg-soft)' }}
                  >
                    {c.availability}
                  </span>
                )}
              </div>

              {c.skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {c.skills.map((s) => (
                    <span key={s} className="tag" style={{ fontSize: 12 }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                disabled={shortlistedIds.has(c.id) || savingId === c.id}
                onClick={() => shortlist(c.id)}
              >
                {shortlistedIds.has(c.id) ? 'Shortlisted' : savingId === c.id ? 'Saving…' : 'Shortlist'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
