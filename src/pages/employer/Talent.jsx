import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { notify } from '../../lib/notify.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import { calculateMatchScore } from '../../lib/matchScore.js'
import EmptyState from '../../components/EmptyState.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import CandidateAvatar from '../../components/CandidateAvatar.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'
import QuickMessageModal from '../../components/QuickMessageModal.jsx'
import ViewToggle from '../../components/ViewToggle.jsx'

const AVAILABILITY_OPTIONS = ['Immediately', 'Within a month', '1 to 3 months', 'Just exploring']
const WORK_STYLE_OPTIONS = ['Remote', 'Hybrid', 'On-site']
const VIEW_MODE_KEY = 'mellow_talent_view_mode'
const SWIPE_THRESHOLD = 80
const SKILLS_SHOWN_COLLAPSED = 10

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function MessageIconSvg() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function TalentFeed() {
  const { user } = useAuth()

  const cacheKey = user ? `talent:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [employerId, setEmployerId] = useState(cached?.employerId ?? null)
  const [candidates, setCandidates] = useState(cached?.candidates ?? [])
  const [shortlistedIds, setShortlistedIds] = useState(new Set(cached?.shortlistedIds ?? []))
  const [workVideoCounts, setWorkVideoCounts] = useState(cached?.workVideoCounts ?? {})
  const [myRoles, setMyRoles] = useState(cached?.myRoles ?? [])
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeSkills, setActiveSkills] = useState(new Set())
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [activeAvailability, setActiveAvailability] = useState(new Set())
  const [activeWorkStyle, setActiveWorkStyle] = useState(new Set())

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid'
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid'
  })
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [messagingCandidate, setMessagingCandidate] = useState(null)

  const [swipeMode, setSwipeMode] = useState(false)
  const [swipeIndex, setSwipeIndex] = useState(0)
  const touchStartXRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])

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

      const [{ data: liveCandidates, error: candidatesError }, { data: shortlists, error: shortlistError }, { data: rolesData }] =
        await Promise.all([
          supabase
            .from('candidate_profiles')
            .select(
              'id, user_id, username, full_name, job_title, current_company, years_of_experience, location, skills, availability, work_style, intro_video_url, avatar_url',
            )
            .eq('is_live', true)
            .eq('is_open_to_opportunities', true)
            .order('created_at', { ascending: false }),
          supabase.from('shortlists').select('candidate_id').eq('employer_id', resolvedId),
          supabase
            .from('roles')
            .select('id, title, required_skills, role_type')
            .eq('employer_id', resolvedId)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
        ])

      if (candidatesError) {
        setError(candidatesError.message)
        setLoading(false)
        return
      }
      setCandidates(liveCandidates)

      const shortlistIds = shortlistError ? [] : shortlists.map((s) => s.candidate_id)
      if (!shortlistError) setShortlistedIds(new Set(shortlistIds))

      const roles = rolesData || []
      setMyRoles(roles)

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
          myRoles: roles,
        })
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Only roles with required_skills set can produce a meaningful score — the
  // skills overlap is the highest-weighted signal, so without it the other
  // three factors alone would be misleadingly precise.
  const scorableRoles = useMemo(() => myRoles.filter((r) => r.required_skills?.length > 0), [myRoles])

  // Defaults to the first scorable role once roles load, so the score shows
  // up without the employer needing to touch the dropdown first.
  useEffect(() => {
    if (selectedRoleId || scorableRoles.length === 0) return
    setSelectedRoleId(scorableRoles[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorableRoles])

  const selectedRole = scorableRoles.find((r) => r.id === selectedRoleId) || null

  function matchScoreFor(candidate) {
    if (!selectedRole) return null
    return calculateMatchScore(candidate, selectedRole)
  }

  // Ranked by how many candidates have each skill, most common first —
  // the filter bar only shows the top SKILLS_SHOWN_COLLAPSED by default
  // (see showAllSkills) so a platform with a long tail of one-off skills
  // doesn't turn this into a wall of tags.
  const allSkills = useMemo(() => {
    const counts = new Map()
    candidates.forEach((c) => c.skills.forEach((s) => counts.set(s, (counts.get(s) || 0) + 1)))
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([skill]) => skill)
  }, [candidates])
  const visibleSkills = showAllSkills ? allSkills : allSkills.slice(0, SKILLS_SHOWN_COLLAPSED)

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

  // Swipe screening mode — same filtered queue as the grid/list, so any
  // active search/filter carries over into swipe mode too.
  const swipeQueue = filtered
  const swipeCandidate = swipeQueue[swipeIndex]
  const swipeDone = swipeQueue.length > 0 && swipeIndex >= swipeQueue.length

  function openSwipeMode() {
    setSwipeIndex(0)
    setSwipeMode(true)
  }

  function closeSwipeMode() {
    setSwipeMode(false)
  }

  async function handleSwipeShortlist() {
    if (!swipeCandidate) return
    if (!shortlistedIds.has(swipeCandidate.id)) await shortlist(swipeCandidate.id)
    setSwipeIndex((i) => i + 1)
  }

  function handleSwipeSkip() {
    if (!swipeCandidate) return
    setSwipeIndex((i) => i + 1)
  }

  useEffect(() => {
    if (!swipeMode) return
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        closeSwipeMode()
        return
      }
      const key = e.key.toLowerCase()
      if (e.key === 'ArrowRight' || key === 'l') handleSwipeShortlist()
      else if (e.key === 'ArrowLeft' || key === 'j') handleSwipeSkip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeMode, swipeCandidate, shortlistedIds])

  function handleTouchStart(e) {
    touchStartXRef.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartXRef.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
    touchStartXRef.current = null
    if (deltaX > SWIPE_THRESHOLD) handleSwipeShortlist()
    else if (deltaX < -SWIPE_THRESHOLD) handleSwipeSkip()
  }

  if (loading) return <ListPageSkeleton titleWidth={200} rows={6} cards />

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  if (swipeMode) {
    return (
      <div className="swipe-overlay">
        <div className="swipe-topbar">
          <button type="button" className="btn btn-ghost" onClick={closeSwipeMode} style={{ padding: '7px 14px', fontSize: 13 }}>
            Exit
          </button>
          <div className="swipe-progress-track">
            <div
              className="swipe-progress-fill"
              style={{ width: `${swipeQueue.length > 0 ? Math.min(100, (swipeIndex / swipeQueue.length) * 100) : 0}%` }}
            />
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {Math.min(swipeIndex, swipeQueue.length)} / {swipeQueue.length}
          </p>
        </div>

        <div className="swipe-stage">
          {swipeDone || !swipeCandidate ? (
            <div style={{ textAlign: 'center', maxWidth: 320 }}>
              <h2 style={{ fontSize: 22 }}>You're all caught up</h2>
              <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>
                You've screened every candidate matching your current filters.
              </p>
              <button type="button" className="btn btn-primary" onClick={closeSwipeMode} style={{ marginTop: 20 }}>
                Back to feed
              </button>
            </div>
          ) : (
            <div className="swipe-card" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              <div className="swipe-card-media">
                {swipeCandidate.intro_video_url ? (
                  <video key={swipeCandidate.id} src={swipeCandidate.intro_video_url} autoPlay muted loop playsInline controls />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                    <CandidateAvatar avatarUrl={swipeCandidate.avatar_url} fullName={swipeCandidate.full_name} size={120} style={{ fontSize: 42 }} />
                  </div>
                )}
              </div>
              <div className="swipe-card-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 19 }}>{swipeCandidate.full_name}</h2>
                  {matchScoreFor(swipeCandidate) !== null && (
                    <span className="tag" style={{ background: 'var(--color-primary)', color: '#fff', fontWeight: 700 }}>
                      {matchScoreFor(swipeCandidate)}% match
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {swipeCandidate.current_company ? `${swipeCandidate.job_title} at ${swipeCandidate.current_company}` : swipeCandidate.job_title}
                </p>
                {swipeCandidate.location && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{swipeCandidate.location}</p>
                )}
                {swipeCandidate.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {swipeCandidate.skills.slice(0, 3).map((s) => (
                      <span key={s} className="tag" style={{ fontSize: 12 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!swipeDone && swipeCandidate && (
          <>
            <div className="swipe-actions">
              <button type="button" className="swipe-action-btn skip" onClick={handleSwipeSkip} aria-label="Skip">
                <XIcon />
              </button>
              <button type="button" className="swipe-action-btn shortlist" onClick={handleSwipeShortlist} aria-label="Shortlist">
                <CheckIcon />
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 16, marginTop: -8 }}>
              ✕ to pass, ✓ to shortlist
            </p>
          </>
        )}
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
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {visibleSkills.map((skill) => (
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
            {allSkills.length > SKILLS_SHOWN_COLLAPSED && (
              <button
                type="button"
                onClick={() => setShowAllSkills((prev) => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: 0,
                  marginTop: 8,
                  cursor: 'pointer',
                }}
              >
                {showAllSkills ? 'Show less' : `Show more (${allSkills.length - SKILLS_SHOWN_COLLAPSED})`}
              </button>
            )}
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

      {myRoles.length > 0 && scorableRoles.length === 0 && (
        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: 'var(--color-text-muted)',
            background: 'var(--color-bg-soft)',
            borderRadius: 8,
            padding: '10px 14px',
          }}
        >
          Add required skills to your active roles to see match scores here.{' '}
          <Link to="/employer/roles" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Edit your roles →
          </Link>
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {scorableRoles.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="match-role" style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Match against:
              </label>
              <select
                id="match-role"
                className="input"
                style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                {scorableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={openSwipeMode} disabled={filtered.length === 0} style={{ fontSize: 13, padding: '9px 16px' }}>
            Quick screen
          </button>
        </div>

        <ViewToggle mode={viewMode} onChange={setViewMode} />
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
      ) : viewMode === 'grid' ? (
        <div className="compact-grid" style={{ marginTop: 24 }}>
          {filtered.map((c) => {
            const profileUrl = `/profile/${c.username || c.id}`
            const topSkills = (c.skills || []).slice(0, 2)
            const score = matchScoreFor(c)
            const isShortlisted = shortlistedIds.has(c.id)
            return (
              <div key={c.id} className="card compact-card">
                <div className="compact-card-actions">
                  <button
                    type="button"
                    className={`compact-card-icon-btn${isShortlisted ? ' active' : ''}`}
                    disabled={isShortlisted || savingId === c.id}
                    onClick={() => shortlist(c.id)}
                    aria-label={isShortlisted ? 'Shortlisted' : 'Shortlist'}
                    title={isShortlisted ? 'Shortlisted' : 'Shortlist'}
                  >
                    <CheckIcon />
                  </button>
                  <button
                    type="button"
                    className="compact-card-icon-btn"
                    onClick={() => setMessagingCandidate(c)}
                    aria-label={`Message ${c.full_name}`}
                    title="Message"
                  >
                    <MessageIconSvg />
                  </button>
                </div>

                {score !== null && <span className="match-score-badge">{score}% match</span>}

                <div className="compact-card-media">
                  {c.intro_video_url ? (
                    <VideoPlayCard
                      url={c.intro_video_url}
                      format="auto"
                      objectFit="contain"
                      style={{ position: 'absolute', inset: 0, maxWidth: 'none', aspectRatio: 'auto', borderRadius: 0, margin: 0 }}
                    />
                  ) : (
                    <Link to={profileUrl} className="compact-card-avatar-fallback">
                      <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={76} style={{ fontSize: 28 }} />
                    </Link>
                  )}
                </div>

                <div className="compact-card-body">
                  <Link to={profileUrl} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <CandidateAvatar avatarUrl={c.avatar_url} fullName={c.full_name} size={30} style={{ fontSize: 13 }} />
                    <h3 style={{ fontSize: 14, lineHeight: 1.3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.full_name}
                    </h3>
                  </Link>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.current_company ? `${c.job_title} at ${c.current_company}` : c.job_title}
                  </p>

                  {c.location && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.location}
                    </p>
                  )}

                  {topSkills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {topSkills.map((s) => (
                        <span key={s} className="tag" style={{ fontSize: 11, padding: '2px 8px' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {c.availability && (
                    <span
                      className="tag"
                      style={{ fontSize: 11, padding: '2px 8px', background: '#e3f9e9', color: '#0f7a3d', width: 'fit-content' }}
                    >
                      {c.availability}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
            marginTop: 24,
          }}
        >
          {filtered.map((c) => {
            const score = matchScoreFor(c)
            return (
              <div key={c.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
                {score !== null && (
                  <span className="tag" style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, background: 'var(--color-primary)', color: '#fff', fontWeight: 700 }}>
                    {score}% match
                  </span>
                )}
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

                <div className="talent-list-card-actions" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 32, padding: '0 14px', fontSize: 13 }}
                    disabled={shortlistedIds.has(c.id) || savingId === c.id}
                    onClick={() => shortlist(c.id)}
                  >
                    {shortlistedIds.has(c.id) ? 'Shortlisted' : savingId === c.id ? 'Saving…' : 'Shortlist'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setMessagingCandidate(c)}
                    aria-label={`Message ${c.full_name}`}
                    title="Message"
                  >
                    <MessageIconSvg />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {messagingCandidate && (
        <QuickMessageModal
          recipientUserId={messagingCandidate.user_id}
          recipientLabel={messagingCandidate.full_name}
          onClose={() => setMessagingCandidate(null)}
        />
      )}
    </div>
  )
}
