import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import { formatDeadline, formatSalary, scoreRoleForCandidate } from '../../lib/roleFormat.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import EmptyState from '../../components/EmptyState.jsx'
import Modal from '../../components/Modal.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import SaveRoleButton from '../../components/SaveRoleButton.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'
import ViewToggle from '../../components/ViewToggle.jsx'

const MAX_RECOMMENDATIONS = 5
const VIEW_MODE_KEY = 'mellow_roles_view_mode'
// Matches .role-card-collapsed's fixed height in components.css, minus the
// card's own 24px top/bottom padding — the budget the header/description/
// what-matters content actually has to fit inside before it's truncated.
const ROLE_CARD_COLLAPSED_HEIGHT = 300
const ROLE_CARD_CONTENT_BUDGET = ROLE_CARD_COLLAPSED_HEIGHT - 48

// Standalone component (not an inline render function) so it can hold its
// own ref + effect: after each render it measures whether the role's real
// header/description/what-matters content is taller than the collapsed
// card can show, and only then does a Show more toggle even appear — a
// short role with nothing left to reveal never gets one.
function RoleCard({ role, applied, applying, saved, onToggleSave, onApply, needsVideo, onShowVideo, expanded, onToggleExpanded }) {
  const navigate = useNavigate()
  const contentRef = useRef(null)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    function measure() {
      const el = contentRef.current
      if (!el) return
      // Mobile drops the fixed collapsed height entirely (see the
      // @media override on .role-card-collapsed), so there's nothing to
      // truncate there and no toggle is ever needed.
      setOverflowing(window.innerWidth > 768 && el.scrollHeight > ROLE_CARD_CONTENT_BUDGET)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [role.description, role.what_matters])

  const employer = role.employer_profiles
  const deadlineLabel = formatDeadline(role.deadline)
  const salaryLabel = formatSalary(role)
  const truncated = overflowing && !expanded

  return (
    <div
      className={`card role-card${truncated ? ' role-card-collapsed' : overflowing && expanded ? ' role-card-expanded' : ''}`}
      style={{ padding: 24, cursor: 'pointer' }}
      onClick={() => navigate(`/jobs/${role.slug}`)}
    >
      <div className="role-card-actions">
        <SaveRoleButton saved={saved} onToggle={onToggleSave} />
        <button
          type="button"
          className={applied ? 'btn btn-ghost' : 'btn btn-primary'}
          disabled={applied || applying}
          onClick={(e) => {
            e.stopPropagation()
            onApply()
          }}
          style={{ whiteSpace: 'nowrap' }}
        >
          {applied ? 'Applied' : applying ? 'Applying…' : 'Apply'}
        </button>
      </div>
      <div ref={contentRef}>
        <div className={`role-card-header${employer?.logo_url ? '' : ' no-logo'}`}>
          <h3 className="role-card-title" style={{ fontSize: 19 }}>{role.title}</h3>
          {employer?.logo_url && (
            employer.company_slug ? (
              <Link
                to={`/company/${employer.company_slug}`}
                className="role-card-logo-area"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={employer.logo_url}
                  alt=""
                  className="role-card-logo"
                  style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)' }}
                />
              </Link>
            ) : (
              <img
                src={employer.logo_url}
                alt=""
                className="role-card-logo role-card-logo-area"
                style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)' }}
              />
            )
          )}
          <p className="role-card-company" style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {employer?.company_slug ? (
              <Link
                to={`/company/${employer.company_slug}`}
                style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
                onClick={(e) => e.stopPropagation()}
              >
                {employer?.company_name}
              </Link>
            ) : (
              employer?.company_name
            )}{' '}
            · {role.location} ·{' '}
            {role.role_type[0].toUpperCase() + role.role_type.slice(1).replace('-', ' ')}
          </p>
          <div className="role-card-rest">
            {(employer?.industry || employer?.company_size) && (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {[employer?.industry, employer?.company_size && `${employer.company_size} employees`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <div className="role-card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {employer?.company_highlight && (
                <span className="tag" style={{ fontSize: 12 }}>
                  {employer.company_highlight}
                </span>
              )}
              {salaryLabel && (
                <span className="tag" style={{ fontSize: 12 }}>
                  {salaryLabel}
                </span>
              )}
              {role.work_style && (
                <span className="tag" style={{ fontSize: 12 }}>
                  {role.work_style}
                </span>
              )}
              {deadlineLabel && (
                <span className="tag" style={{ fontSize: 12 }}>
                  Apply by {deadlineLabel}
                </span>
              )}
              {employer?.intro_video_url && (
                <button
                  type="button"
                  className="tag"
                  style={{ fontSize: 12, border: 'none', cursor: 'pointer', background: '#005ef5', color: '#ffffff' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onShowVideo(employer)
                  }}
                >
                  <span style={{ fontSize: 9 }} aria-hidden="true">▶</span>
                  See the team
                </button>
              )}
            </div>
            {role.required_skills?.length > 0 && (
              <div className="role-card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {role.required_skills.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className="tag"
                    style={{ fontSize: 12, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {role.description && (
          <div style={{ marginTop: 14 }}>
            <p
              style={{
                fontSize: 15,
                color: 'var(--color-text-muted)',
                ...(truncated
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
                  : {}),
              }}
            >
              {role.description}
            </p>
          </div>
        )}
        {(expanded || !overflowing) && role.what_matters && (
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>What matters most: </strong>
            {role.what_matters}
          </p>
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpanded()
          }}
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
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {needsVideo && (
        <div
          className="card"
          style={{ marginTop: 14, padding: '16px 20px', background: '#fff4e5', border: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ fontSize: 14, fontWeight: 600 }}>
            Please add your profile video before applying. Employers want to meet you first.
          </p>
          <Link to="/profile/edit" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
            Add your profile video
          </Link>
        </div>
      )}
    </div>
  )
}

export default function BrowseRoles() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const cacheKey = user ? `candidate-roles:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [candidateId, setCandidateId] = useState(cached?.candidateId ?? null)
  const [candidateInfo, setCandidateInfo] = useState(cached?.candidateInfo ?? null)
  const [roles, setRoles] = useState(cached?.roles ?? [])
  const [appliedRoleIds, setAppliedRoleIds] = useState(new Set(cached?.appliedRoleIds ?? []))
  const [savedEntries, setSavedEntries] = useState(cached?.savedEntries ?? []) // saved_roles rows joined with roles()
  // Deep-linkable via /roles?tab=saved (e.g. from the dashboard's saved-roles link).
  const [tab, setTab] = useState(searchParams.get('tab') === 'saved' ? 'saved' : 'browse')
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [applyingId, setApplyingId] = useState(null)
  const [needsVideoRoleId, setNeedsVideoRoleId] = useState(null)
  const [videoModalEmployer, setVideoModalEmployer] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid'
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid'
  })

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select('id, skills, job_title, work_style, availability, location, years_of_experience')
        .eq('user_id', user.id)
        .maybeSingle()

      if (candidateError) {
        setError(candidateError.message)
        setLoading(false)
        return
      }
      if (!candidate) {
        setError('Finish your profile before browsing roles.')
        setLoading(false)
        return
      }
      setCandidateId(candidate.id)
      setCandidateInfo({
        skills: candidate.skills || [],
        jobTitle: candidate.job_title || '',
        workStyle: candidate.work_style || [],
        availability: candidate.availability || '',
        location: candidate.location || '',
        yearsOfExperience: candidate.years_of_experience || '',
      })

      const [{ data: activeRoles, error: rolesError }, { data: applications, error: applicationsError }, { data: saved }] =
        await Promise.all([
          supabase
            .from('roles')
            .select(
              'id, slug, title, location, role_type, description, what_matters, deadline, salary_min, salary_max, salary_currency, created_at, work_style, is_urgent, required_skills, employer_profiles!inner(company_name, company_slug, industry, company_size, culture_description, company_highlight, logo_url, intro_video_url, typical_roles, is_visible)',
            )
            .eq('is_active', true)
            .eq('employer_profiles.is_visible', true)
            .order('created_at', { ascending: false }),
          supabase.from('applications').select('role_id').eq('candidate_id', candidate.id),
          supabase
            .from('saved_roles')
            .select(
              'id, role_id, role_title, company_name, created_at, roles(id, slug, title, location, role_type, deadline, salary_min, salary_max, salary_currency, is_active, employer_profiles(company_name, logo_url, company_slug))',
            )
            .eq('candidate_id', candidate.id)
            .order('created_at', { ascending: false }),
        ])

      if (rolesError) {
        setError(rolesError.message)
        setLoading(false)
        return
      }
      setRoles(activeRoles)

      const appliedIds = applicationsError ? [] : applications.map((a) => a.role_id)
      if (!applicationsError) setAppliedRoleIds(new Set(appliedIds))

      const savedRows = saved || []
      setSavedEntries(savedRows)

      setLoading(false)

      if (cacheKey) {
        setCachedPage(cacheKey, {
          candidateId: candidate.id,
          candidateInfo: {
            skills: candidate.skills || [],
            jobTitle: candidate.job_title || '',
            workStyle: candidate.work_style || [],
            availability: candidate.availability || '',
            location: candidate.location || '',
            yearsOfExperience: candidate.years_of_experience || '',
          },
          roles: activeRoles,
          appliedRoleIds: appliedIds,
          savedEntries: savedRows,
        })
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const savedRoleIds = useMemo(() => new Set(savedEntries.filter((s) => s.role_id).map((s) => s.role_id)), [savedEntries])

  const searchedRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return roles
    return roles.filter((role) => {
      const haystack = [
        role.title,
        role.employer_profiles?.company_name,
        role.location,
        role.description,
        role.what_matters,
        ...(role.required_skills || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [roles, searchQuery])

  const recommended = useMemo(() => {
    if (!candidateId || !candidateInfo) return []
    return searchedRoles
      .map((role) => ({ role, score: scoreRoleForCandidate(role, candidateInfo, appliedRoleIds) }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECOMMENDATIONS)
      .map((entry) => entry.role)
  }, [searchedRoles, candidateId, candidateInfo, appliedRoleIds])

  async function toggleSave(role) {
    const existing = savedEntries.find((s) => s.role_id === role.id)
    if (existing) {
      const { error: deleteError } = await supabase.from('saved_roles').delete().eq('id', existing.id)
      if (!deleteError) setSavedEntries((prev) => prev.filter((s) => s.id !== existing.id))
      return
    }
    const { data, error: insertError } = await supabase
      .from('saved_roles')
      .insert({
        candidate_id: candidateId,
        role_id: role.id,
        role_title: role.title,
        company_name: role.employer_profiles?.company_name || null,
      })
      .select('id, role_id, role_title, company_name, created_at, roles(id, slug, title, location, role_type, deadline, salary_min, salary_max, salary_currency, is_active, employer_profiles(company_name, logo_url, company_slug))')
      .single()
    if (!insertError) setSavedEntries((prev) => [data, ...prev])
  }

  async function removeSaved(entryId) {
    const { error: deleteError } = await supabase.from('saved_roles').delete().eq('id', entryId)
    if (!deleteError) setSavedEntries((prev) => prev.filter((s) => s.id !== entryId))
  }

  async function apply(roleId) {
    if (!candidateId) return
    setApplyingId(roleId)

    // Checked fresh here, at click time — same as the RolePublic apply flow.
    // This page is its own separate apply path (candidates browsing /roles),
    // so it needs its own copy of this check rather than sharing state with
    // the individual role page.
    const { data: candidate } = await supabase
      .from('candidate_profiles')
      .select('intro_video_url')
      .eq('user_id', user.id)
      .maybeSingle()

    const introVideoUrl = candidate?.intro_video_url
    const missingVideo = introVideoUrl === null || introVideoUrl === undefined || introVideoUrl.trim() === ''
    if (missingVideo) {
      setNeedsVideoRoleId(roleId)
      setApplyingId(null)
      return
    }
    setNeedsVideoRoleId(null)

    const { data, error: insertError } = await supabase
      .from('applications')
      .insert({ candidate_id: candidateId, role_id: roleId, status: 'applied' })
      .select()
      .single()
    if (!insertError) {
      setAppliedRoleIds((prev) => new Set(prev).add(roleId))
      notify('application-notification', { applicationId: data.id })
    }
    setApplyingId(null)
  }

  if (loading) return <ListPageSkeleton titleWidth={160} rows={4} />

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  function renderCompactRoleCard(role) {
    const applied = appliedRoleIds.has(role.id)
    const employer = role.employer_profiles
    const salaryLabel = formatSalary(role)
    // One merged row, capped at 3. Skills go first so a role with 2+
    // required_skills always shows at least 2 of them — location/work
    // style/salary only fill whatever room skills don't use.
    const skillTags = (role.required_skills || []).slice(0, 3)
    const infoTags = [role.location, role.work_style, salaryLabel].filter(Boolean)
    const cardTags = [...skillTags, ...infoTags].slice(0, 3)
    return (
      <div key={role.id} className="card compact-card" style={{ height: 180, cursor: 'pointer' }} onClick={() => navigate(`/jobs/${role.slug}`)}>
        <div className="compact-card-actions">
          <SaveRoleButton saved={savedRoleIds.has(role.id)} onToggle={() => toggleSave(role)} />
        </div>

        <div className="compact-card-body" style={{ flex: 1, padding: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {employer?.logo_url ? (
              <img
                src={employer.logo_url}
                alt=""
                style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 7, background: 'var(--color-bg-soft)', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 7,
                  background: 'var(--color-bg-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              >
                {employer?.company_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 15, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {role.title}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {employer?.company_name}
              </p>
            </div>
          </div>

          {cardTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {cardTags.map((t) => (
                <span key={t} className="tag" style={{ fontSize: 11, padding: '2px 8px' }}>
                  {t}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            className={applied ? 'btn btn-ghost' : 'btn btn-primary'}
            disabled={applied || applyingId === role.id}
            onClick={(e) => {
              e.stopPropagation()
              apply(role.id)
            }}
            style={{ marginTop: 'auto', alignSelf: 'center', fontSize: 13, padding: '8px 28px' }}
          >
            {applied ? 'Applied' : applyingId === role.id ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    )
  }

  function renderSavedEntry(entry) {
    const role = entry.roles
    const expired = !role || !role.is_active
    if (expired) {
      return (
        <div key={entry.id} className="card role-card" style={{ padding: 20, opacity: 0.75 }}>
          <div className="role-card-actions">
            <button type="button" className="btn btn-ghost" onClick={() => removeSaved(entry.id)} style={{ whiteSpace: 'nowrap' }}>
              Remove
            </button>
          </div>
          <div className="role-card-header no-logo">
            <h3 className="role-card-title" style={{ fontSize: 17 }}>{entry.role_title}</h3>
            <p className="role-card-company" style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>{entry.company_name}</p>
            <div className="role-card-rest">
              <span className="tag" style={{ marginTop: 8, display: 'inline-block', fontSize: 12 }}>
                Expired
              </span>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                This role is no longer accepting applications.
              </p>
            </div>
          </div>
        </div>
      )
    }
    const employer = role.employer_profiles
    const deadlineLabel = formatDeadline(role.deadline)
    const salaryLabel = formatSalary(role)
    return (
      <div key={entry.id} className="card role-card" style={{ padding: 20, cursor: 'pointer' }} onClick={() => navigate(`/jobs/${role.slug}`)}>
        <div className="role-card-actions">
          <SaveRoleButton saved onToggle={() => removeSaved(entry.id)} />
        </div>
        <div className={`role-card-header${employer?.logo_url ? '' : ' no-logo'}`}>
          <h3 className="role-card-title" style={{ fontSize: 17 }}>{role.title}</h3>
          {employer?.logo_url && (
            employer.company_slug ? (
              <Link
                to={`/company/${employer.company_slug}`}
                className="role-card-logo-area"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={employer.logo_url}
                  alt=""
                  className="role-card-logo"
                  style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)' }}
                />
              </Link>
            ) : (
              <img
                src={employer.logo_url}
                alt=""
                className="role-card-logo role-card-logo-area"
                style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)' }}
              />
            )
          )}
          <p className="role-card-company" style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {employer?.company_slug ? (
              <Link
                to={`/company/${employer.company_slug}`}
                style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
                onClick={(e) => e.stopPropagation()}
              >
                {employer?.company_name}
              </Link>
            ) : (
              employer?.company_name
            )}{' '}
            · {role.location}
          </p>
          <div className="role-card-rest">
            <div className="role-card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {salaryLabel && <span className="tag" style={{ fontSize: 12 }}>{salaryLabel}</span>}
              {deadlineLabel && <span className="tag" style={{ fontSize: 12 }}>Apply by {deadlineLabel}</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Open roles</h1>
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg-soft)', borderRadius: 8, padding: 4 }}>
          <button
            type="button"
            onClick={() => setTab('browse')}
            className={tab === 'browse' ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '6px 16px', fontSize: 13, border: 'none' }}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={() => setTab('saved')}
            className={tab === 'saved' ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '6px 16px', fontSize: 13, border: 'none' }}
          >
            Saved{savedEntries.length > 0 && ` (${savedEntries.length})`}
          </button>
        </div>
      </div>

      {tab === 'browse' && (
        <div style={{ marginTop: 20, maxWidth: 720, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="Search by title, company, skills, or location…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      )}

      {tab === 'saved' ? (
        savedEntries.length === 0 ? (
          <EmptyState
            heading="No saved roles yet"
            body="Tap the bookmark icon on any role to save it here for later."
            illustration="/Collaborate2.png"
          />
        ) : (
          <div className="role-list" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28, maxWidth: 720 }}>
            {savedEntries.map(renderSavedEntry)}
          </div>
        )
      ) : roles.length === 0 ? (
        <EmptyState
          heading="No open roles yet"
          body="New roles are added regularly. Make sure your profile is complete so employers can find you in the meantime."
          illustration="/Collaborate2.png"
        />
      ) : searchedRoles.length === 0 ? (
        <EmptyState
          heading="No roles match your search"
          body="Try a different title, skill, company, or location."
          illustration="/Collaborate2.png"
        />
      ) : (
        <div style={{ marginTop: 28, maxWidth: 720 }}>
          {recommended.length > 0 && (
            <div
              className="recommended-section"
              style={{
                marginBottom: 32,
                padding: 20,
                background: '#EEF4FF',
                borderRadius: 12,
              }}
            >
              <div className="recommended-heading" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <SparkleIcon />
                <h3 style={{ fontSize: 18 }}>Recommended for you</h3>
              </div>
              {viewMode === 'grid' ? (
                <div className="compact-grid">{recommended.map((role) => renderCompactRoleCard(role))}</div>
              ) : (
                <div className="role-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {recommended.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      applied={appliedRoleIds.has(role.id)}
                      applying={applyingId === role.id}
                      saved={savedRoleIds.has(role.id)}
                      onToggleSave={() => toggleSave(role)}
                      onApply={() => apply(role.id)}
                      needsVideo={needsVideoRoleId === role.id}
                      onShowVideo={setVideoModalEmployer}
                      expanded={expandedIds.has(role.id)}
                      onToggleExpanded={() =>
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(role.id)) next.delete(role.id)
                          else next.add(role.id)
                          return next
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 14 }}>All open roles</h3>
            {viewMode === 'grid' ? (
              <div className="compact-grid">{searchedRoles.map((role) => renderCompactRoleCard(role))}</div>
            ) : (
              <div className="role-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {searchedRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    applied={appliedRoleIds.has(role.id)}
                    applying={applyingId === role.id}
                    saved={savedRoleIds.has(role.id)}
                    onToggleSave={() => toggleSave(role)}
                    onApply={() => apply(role.id)}
                    needsVideo={needsVideoRoleId === role.id}
                    onShowVideo={setVideoModalEmployer}
                    expanded={expandedIds.has(role.id)}
                    onToggleExpanded={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(role.id)) next.delete(role.id)
                        else next.add(role.id)
                        return next
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {videoModalEmployer && (
        <Modal
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {videoModalEmployer.logo_url && (
                <img
                  src={videoModalEmployer.logo_url}
                  alt=""
                  style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, background: 'var(--color-bg-soft)' }}
                />
              )}
              {videoModalEmployer.company_name}
            </span>
          }
          onClose={() => setVideoModalEmployer(null)}
          width={520}
        >
          <VideoPlayCard url={videoModalEmployer.intro_video_url} format="horizontal" />
        </Modal>
      )}
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-primary)" aria-hidden="true">
      <path d="M12 2l1.8 5.6L19.4 9.4 13.8 11.2 12 17l-1.8-5.8L4.6 9.4l5.6-1.8L12 2z" />
      <path d="M19 15l0.8 2.5 2.5 0.8-2.5 0.8-0.8 2.5-0.8-2.5-2.5-0.8 2.5-0.8z" />
    </svg>
  )
}
