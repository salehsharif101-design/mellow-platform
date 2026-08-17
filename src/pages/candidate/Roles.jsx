import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import { formatDeadline, formatSalary, roleMatchesCandidate } from '../../lib/roleFormat.js'
import EmptyState from '../../components/EmptyState.jsx'
import Modal from '../../components/Modal.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import SaveRoleButton from '../../components/SaveRoleButton.jsx'

const MAX_RECOMMENDATIONS = 5

export default function BrowseRoles() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [candidateId, setCandidateId] = useState(null)
  const [candidateSkills, setCandidateSkills] = useState([])
  const [candidateJobTitle, setCandidateJobTitle] = useState('')
  const [roles, setRoles] = useState([])
  const [appliedRoleIds, setAppliedRoleIds] = useState(new Set())
  const [savedEntries, setSavedEntries] = useState([]) // saved_roles rows joined with roles()
  const [tab, setTab] = useState('browse') // 'browse' | 'saved'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyingId, setApplyingId] = useState(null)
  const [needsVideoRoleId, setNeedsVideoRoleId] = useState(null)
  const [videoModalEmployer, setVideoModalEmployer] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select('id, skills, job_title')
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
      setCandidateSkills(candidate.skills || [])
      setCandidateJobTitle(candidate.job_title || '')

      const [{ data: activeRoles, error: rolesError }, { data: applications, error: applicationsError }, { data: saved }] =
        await Promise.all([
          supabase
            .from('roles')
            .select(
              'id, slug, title, location, role_type, description, what_matters, deadline, salary_min, salary_max, salary_currency, employer_profiles!inner(company_name, company_slug, industry, company_size, culture_description, company_highlight, logo_url, intro_video_url, typical_roles, is_visible)',
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

      if (rolesError) setError(rolesError.message)
      else setRoles(activeRoles)

      if (!applicationsError) setAppliedRoleIds(new Set(applications.map((a) => a.role_id)))

      setSavedEntries(saved || [])

      setLoading(false)
    }

    load()
  }, [user])

  const savedRoleIds = useMemo(() => new Set(savedEntries.filter((s) => s.role_id).map((s) => s.role_id)), [savedEntries])

  const recommended = useMemo(() => {
    if (!candidateId) return []
    return roles.filter((role) => roleMatchesCandidate(role, candidateSkills, candidateJobTitle)).slice(0, MAX_RECOMMENDATIONS)
  }, [roles, candidateId, candidateSkills, candidateJobTitle])

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

  if (loading) return null

  if (error) {
    return (
      <div className="section">
        <p className="form-error">{error}</p>
      </div>
    )
  }

  function renderRoleCard(role, { compact = false } = {}) {
    const applied = appliedRoleIds.has(role.id)
    const employer = role.employer_profiles
    const culture = employer?.culture_description
    const cultureShort = culture && culture.length > 60 ? `${culture.slice(0, 60).trim()}…` : culture
    const deadlineLabel = formatDeadline(role.deadline)
    const salaryLabel = formatSalary(role)
    const expanded = expandedIds.has(role.id)
    return (
      <div
        key={role.id}
        className="card"
        style={{ padding: 24, cursor: 'pointer' }}
        onClick={() => navigate(`/jobs/${role.slug}`)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {employer?.logo_url && (
              employer.company_slug ? (
                <Link
                  to={`/company/${employer.company_slug}`}
                  style={{ flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={employer.logo_url}
                    alt=""
                    style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)' }}
                  />
                </Link>
              ) : (
                <img
                  src={employer.logo_url}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)', flexShrink: 0 }}
                />
              )
            )}
            <div>
              <h3 style={{ fontSize: 19 }}>{role.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
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
              {(employer?.industry || employer?.company_size) && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {[employer?.industry, employer?.company_size && `${employer.company_size} employees`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
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
                      setVideoModalEmployer(employer)
                    }}
                  >
                    <span style={{ fontSize: 9 }} aria-hidden="true">▶</span>
                    See the team
                  </button>
                )}
              </div>
              {cultureShort && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                  “{cultureShort}”
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', height: 'fit-content' }}>
            <SaveRoleButton saved={savedRoleIds.has(role.id)} onToggle={() => toggleSave(role)} />
            <button
              type="button"
              className={applied ? 'btn btn-ghost' : 'btn btn-primary'}
              disabled={applied || applyingId === role.id}
              onClick={(e) => {
                e.stopPropagation()
                apply(role.id)
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              {applied ? 'Applied' : applyingId === role.id ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
        {!compact && role.description && (
          <div style={{ marginTop: 14 }}>
            <p
              style={{
                fontSize: 15,
                color: 'var(--color-text-muted)',
                ...(expanded
                  ? {}
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }),
              }}
            >
              {role.description}
            </p>
            {role.description.length > 180 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(role.id)) next.delete(role.id)
                    else next.add(role.id)
                    return next
                  })
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: 0,
                  marginTop: 4,
                  cursor: 'pointer',
                }}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
        {!compact && role.what_matters && (
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>What matters most: </strong>
            {role.what_matters}
          </p>
        )}
        {needsVideoRoleId === role.id && (
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

  function renderSavedEntry(entry) {
    const role = entry.roles
    const expired = !role || !role.is_active
    if (expired) {
      return (
        <div key={entry.id} className="card" style={{ padding: 20, opacity: 0.75 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: 17 }}>{entry.role_title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>{entry.company_name}</p>
              <span className="tag" style={{ marginTop: 8, display: 'inline-block', fontSize: 12 }}>
                Expired
              </span>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                This role is no longer accepting applications.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => removeSaved(entry.id)} style={{ height: 'fit-content' }}>
              Remove
            </button>
          </div>
        </div>
      )
    }
    const employer = role.employer_profiles
    const deadlineLabel = formatDeadline(role.deadline)
    const salaryLabel = formatSalary(role)
    return (
      <div key={entry.id} className="card" style={{ padding: 20, cursor: 'pointer' }} onClick={() => navigate(`/jobs/${role.slug}`)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {employer?.logo_url && (
              <img
                src={employer.logo_url}
                alt=""
                style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)', flexShrink: 0 }}
              />
            )}
            <div>
              <h3 style={{ fontSize: 17 }}>{role.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {employer?.company_name} · {role.location}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {salaryLabel && <span className="tag" style={{ fontSize: 12 }}>{salaryLabel}</span>}
                {deadlineLabel && <span className="tag" style={{ fontSize: 12 }}>Apply by {deadlineLabel}</span>}
              </div>
            </div>
          </div>
          <SaveRoleButton saved onToggle={() => removeSaved(entry.id)} />
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

      {tab === 'saved' ? (
        savedEntries.length === 0 ? (
          <EmptyState
            heading="No saved roles yet"
            body="Tap the bookmark icon on any role to save it here for later."
            illustration="/Collaborate2.png"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28, maxWidth: 720 }}>
            {savedEntries.map(renderSavedEntry)}
          </div>
        )
      ) : roles.length === 0 ? (
        <EmptyState
          heading="No open roles yet"
          body="New roles are added regularly. Make sure your profile is complete so employers can find you in the meantime."
          illustration="/Collaborate2.png"
        />
      ) : (
        <div style={{ marginTop: 28, maxWidth: 720 }}>
          {recommended.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, marginBottom: 14 }}>Recommended for you</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recommended.map((role) => renderRoleCard(role, { compact: true }))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{roles.map((role) => renderRoleCard(role))}</div>
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
