import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { notify } from '../../lib/notify.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import EmptyState from '../../components/EmptyState.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'

const AVAILABILITY_OPTIONS = ['Immediately', 'Within a month', '1 to 3 months', 'Just exploring']
const WORK_STYLE_OPTIONS = ['Remote', 'Hybrid', 'On-site']

export default function TalentFeed() {
  const { user } = useAuth()

  const cacheKey = user ? `talent:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [employerId, setEmployerId] = useState(cached?.employerId ?? null)
  const [candidates, setCandidates] = useState(cached?.candidates ?? [])
  const [shortlistedIds, setShortlistedIds] = useState(new Set(cached?.shortlistedIds ?? []))
  const [workVideoCounts, setWorkVideoCounts] = useState(cached?.workVideoCounts ?? {})
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeSkills, setActiveSkills] = useState(new Set())
  const [activeAvailability, setActiveAvailability] = useState(new Set())
  const [activeWorkStyle, setActiveWorkStyle] = useState(new Set())

  useEffect(() => {
    if (!user) return

    async function load() {
      const { employerId: resolvedId } = await resolveEmployerId(user.id)
      if (!resolvedId) {
        setError('Finish setting up your company profile before browsing talent.')
        setLoading(false)
        return
      }
      setEmployerId(resolvedId)

      const [{ data: liveCandidates, error: candidatesError }, { data: shortlists, error: shortlistError }] =
        await Promise.all([
          supabase
            .from('candidate_profiles')
            .select(
              'id, username, full_name, job_title, current_company, years_of_experience, location, skills, availability, work_style, intro_video_url, avatar_url',
            )
            .eq('is_live', true)
            .eq('is_open_to_opportunities', true)
            .order('created_at', { ascending: false }),
          supabase.from('shortlists').select('candidate_id').eq('employer_id', resolvedId),
        ])

      if (candidatesError) {
        setError(candidatesError.message)
        setLoading(false)
        return
      }
      setCandidates(liveCandidates)

      const shortlistIds = shortlistError ? [] : shortlists.map((s) => s.candidate_id)
      if (!shortlistError) setShortlistedIds(new Set(shortlistIds))

      const candidateIds = (liveCandidates || []).map((c) => c.id)
      let counts = {}
      if (candidateIds.length > 0) {
        const { data: videoRows } = await supabase
          .from('candidate_videos')
          .select('candidate_id')
          .in('candidate_id', candidateIds)
        ;(videoRows || []).forEach((v) => {
          counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1
        })
        setWorkVideoCounts(counts)
      }

      setLoading(false)

      if (cacheKey) {
        setCachedPage(cacheKey, {
          employerId: resolvedId,
          candidates: liveCandidates,
          shortlistedIds: shortlistIds,
          workVideoCounts: counts,
        })
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const allSkills = useMemo(() => {
    const set = new Set()
    candidates.forEach((c) => c.skills.forEach((s) => set.add(s)))
    return Array.from(set).sort()
  }, [candidates])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return candidates.filter((c) => {
      const matchesSearch =
        !q ||
        [c.full_name, c.job_title, c.location, ...(c.skills || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      const matchesSkills = activeSkills.size === 0 || c.skills.some((s) => activeSkills.has(s))
      const matchesAvailability = activeAvailability.size === 0 || activeAvailability.has(c.availability)
      const matchesWorkStyle = activeWorkStyle.size === 0 || (c.work_style || []).some((w) => activeWorkStyle.has(w))
      return matchesSearch && matchesSkills && matchesAvailability && matchesWorkStyle
    })
  }, [candidates, searchQuery, activeSkills, activeAvailability, activeWorkStyle])

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

  if (loading) return <ListPageSkeleton titleWidth={200} rows={6} cards />

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

      <input
        className="input"
        style={{ marginTop: 20 }}
        placeholder="Search by name, current role, skills, or location…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
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
          heading="No talent yet"
          body="We are growing fast. Check back soon or share Mellow with people you know who are looking for opportunities."
          illustration="/Collaborate2.png"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No talent matches"
          body="Try a different search term or clear a filter to see more candidates."
          illustration="/Collaborate2.png"
        />
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
              <div style={{ position: 'relative' }}>
                <Link
                  to={`/profile/${c.username || c.id}`}
                  style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, lineHeight: 0 }}
                >
                  <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} />
                </Link>
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
              </div>

              <div>
                <Link to={`/profile/${c.username || c.id}`} style={{ textDecoration: 'none' }}>
                  <h3 style={{ fontSize: 17 }}>{c.full_name}</h3>
                </Link>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title} · {c.location}
                </p>
                {c.years_of_experience && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {c.years_of_experience} experience
                  </p>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {c.availability && (
                    <span className="tag" style={{ display: 'inline-flex', fontSize: 12, background: 'var(--color-bg-soft)' }}>
                      {c.availability}
                    </span>
                  )}
                  {workVideoCounts[c.id] > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                      }}
                    >
                      {workVideoCounts[c.id]} work video{workVideoCounts[c.id] === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
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
