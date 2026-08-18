import { useEffect, useState } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import { formatDeadline, formatSalary, formatResponseRate, getCandidateStatusLabel } from '../../lib/roleFormat.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'
import ShareButton from '../../components/ShareButton.jsx'
import SaveRoleButton from '../../components/SaveRoleButton.jsx'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS_LABELS = { open: 'Open', paused: 'Paused', closed: 'Closed' }

const ROLE_SELECT =
  'id, title, location, role_type, description, what_matters, deadline, salary_min, salary_max, salary_currency, required_skills, work_style, status, employer_profiles(company_name, company_slug, logo_url, linkedin_url, website_url, about, intro_video_url, user_id, is_visible)'

export default function RolePublic() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, userType, loading: authLoading } = useAuth()

  const [role, setRole] = useState(null)
  const [redirectSlug, setRedirectSlug] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [candidateId, setCandidateId] = useState(null)
  const [needsVideo, setNeedsVideo] = useState(false)
  const [checkingVideo, setCheckingVideo] = useState(false)
  const [applied, setApplied] = useState(false)
  const [appliedStatus, setAppliedStatus] = useState(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [responseLabel, setResponseLabel] = useState(null)
  const [savedEntryId, setSavedEntryId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error: roleError } = await supabase
        .from('roles')
        .select(ROLE_SELECT)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (data && data.employer_profiles?.is_visible !== false) {
        setRole(data)
        setLoading(false)
        return
      }

      // Old UUID links should still resolve, redirected to the canonical slug URL.
      if (!roleError && UUID_RE.test(slug)) {
        const { data: bySlugLookup } = await supabase.from('roles').select('slug').eq('id', slug).maybeSingle()
        if (bySlugLookup?.slug) {
          setRedirectSlug(bySlugLookup.slug)
          setLoading(false)
          return
        }
      }

      setNotFound(true)
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!user || userType !== 'candidate' || !role) return

    async function loadCandidate() {
      const { data: candidate } = await supabase
        .from('candidate_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!candidate) return
      setCandidateId(candidate.id)

      const { data: existing } = await supabase
        .from('applications')
        .select('id, status')
        .eq('candidate_id', candidate.id)
        .eq('role_id', role.id)
        .maybeSingle()

      if (existing) {
        setApplied(true)
        setAppliedStatus(existing.status)
      }

      const { data: savedRow } = await supabase
        .from('saved_roles')
        .select('id')
        .eq('candidate_id', candidate.id)
        .eq('role_id', role.id)
        .maybeSingle()

      if (savedRow) setSavedEntryId(savedRow.id)
    }
    loadCandidate()
  }, [user, userType, role])

  async function toggleSave() {
    if (!candidateId || !role) return
    if (savedEntryId) {
      const { error: deleteError } = await supabase.from('saved_roles').delete().eq('id', savedEntryId)
      if (!deleteError) setSavedEntryId(null)
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
      .select('id')
      .single()
    if (!insertError) setSavedEntryId(data.id)
  }

  useEffect(() => {
    if (!role?.id) return
    // Fire-and-forget — a failed view count shouldn't affect the page.
    supabase.rpc('increment_role_view', { role_id: role.id }).then(() => {})
  }, [role?.id])

  useEffect(() => {
    const targetUserId = role?.employer_profiles?.user_id
    if (!targetUserId) return
    supabase
      .rpc('employer_avg_response_hours', { target_user_id: targetUserId })
      .maybeSingle()
      .then(({ data }) => {
        if (data) setResponseLabel(formatResponseRate(data.avg_hours, data.response_count))
      })
  }, [role])

  async function handleApply() {
    if (!candidateId || !role) return
    setError('')
    setApplying(true)
    const { data, error: insertError } = await supabase
      .from('applications')
      .insert({ candidate_id: candidateId, role_id: role.id, status: 'applied' })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
    } else {
      setApplied(true)
      setAppliedStatus(data.status)
      notify('application-notification', { applicationId: data.id })
    }
    setApplying(false)
  }

  async function handleCta() {
    console.log('[apply] RolePublic handleCta() clicked — the individual role page (/jobs/:slug) apply flow', {
      authLoading,
      hasUser: !!user,
      userType,
    })
    if (!authLoading && user && userType === 'candidate') {
      // Checked fresh here rather than relying on state loaded when the
      // page mounted — a candidate can remove their video (in another tab,
      // or after coming back to a page they'd left open) without this
      // component re-rendering, so the check has to hit the DB at the
      // moment they actually click Apply. Only candidate_profiles.intro_video_url
      // counts here — candidate_videos (work videos) is a separate table and
      // is never consulted, intentionally.
      setCheckingVideo(true)
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select('intro_video_url')
        .eq('user_id', user.id)
        .maybeSingle()
      setCheckingVideo(false)

      const introVideoUrl = candidate?.intro_video_url
      console.log('[apply video check] intro_video_url from candidate_profiles:', introVideoUrl, {
        userId: user.id,
        candidateError,
      })

      const missingVideo = introVideoUrl === null || introVideoUrl === undefined || introVideoUrl.trim() === ''
      if (missingVideo) {
        setNeedsVideo(true)
        return
      }
      setNeedsVideo(false)
      handleApply()
      return
    }
    navigate('/signup')
  }

  if (loading) return null

  if (redirectSlug) {
    return <Navigate to={`/jobs/${redirectSlug}`} replace />
  }

  if (notFound) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 32 }}>Role not found</h1>
        <p style={{ marginTop: 10, color: 'var(--color-text-muted)' }}>
          This role may have closed or the link may be incorrect.
        </p>
      </div>
    )
  }

  const employer = role.employer_profiles
  const roleTypeLabel = role.role_type[0].toUpperCase() + role.role_type.slice(1).replace('-', ' ')
  const deadlineLabel = formatDeadline(role.deadline)
  const salaryLabel = formatSalary(role)
  const statusLabel = role.status && STATUS_LABELS[role.status]

  const ctaLabel = checkingVideo
    ? 'Checking…'
    : applying
      ? 'Applying…'
      : applied
        ? 'Applied'
        : 'Apply with your Mellow video'

  const applyButton = (
    <button
      type="button"
      className={applied ? 'btn btn-ghost' : 'btn btn-primary'}
      disabled={applied || applying || checkingVideo}
      onClick={handleCta}
      style={{ padding: '12px 40px', fontSize: 15 }}
    >
      {ctaLabel}
    </button>
  )

  return (
    <div className="section">
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="profile-card">
          {userType === 'candidate' && candidateId && (
            <div className="profile-hero-actions">
              <SaveRoleButton saved={Boolean(savedEntryId)} onToggle={toggleSave} size={19} />
            </div>
          )}

          <h1 style={{ fontSize: 28 }}>{role.title}</h1>

          {employer?.company_name && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              {employer.logo_url && (
                employer.company_slug ? (
                  <Link to={`/company/${employer.company_slug}`} style={{ flexShrink: 0 }}>
                    <img
                      src={employer.logo_url}
                      alt=""
                      style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)' }}
                    />
                  </Link>
                ) : (
                  <img
                    src={employer.logo_url}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: 'var(--color-bg-soft)', flexShrink: 0 }}
                  />
                )
              )}
              <p style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {employer.company_slug ? (
                  <Link to={`/company/${employer.company_slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {employer.company_name}
                  </Link>
                ) : (
                  employer.company_name
                )}
                <CompanyLinkIcons
                  linkedinUrl={employer.linkedin_url}
                  websiteUrl={employer.website_url}
                  label={employer.company_name}
                  size={15}
                />
                <ShareButton url={`https://beta.joinmellow.xyz/jobs/${slug}`} label="Share role" />
              </p>
            </div>
          )}

          {responseLabel && (
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{responseLabel}</p>
          )}

          {applied && appliedStatus && (
            <div
              className="card"
              style={{ marginTop: 20, padding: '12px 18px', background: '#EEF4FF', border: 'none' }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
                You applied to this role — Status: {getCandidateStatusLabel(appliedStatus)}
              </p>
            </div>
          )}

          <div className="profile-tag-row" style={{ marginTop: 20 }}>
            {role.location && <span className="tag">{role.location}</span>}
            <span className="tag">{roleTypeLabel}</span>
            {role.work_style && <span className="tag">{role.work_style}</span>}
            {salaryLabel && <span className="tag">{salaryLabel}</span>}
            {deadlineLabel && <span className="tag">Apply by {deadlineLabel}</span>}
            {statusLabel && <span className="tag">{statusLabel}</span>}
          </div>

          {employer?.intro_video_url && (
            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Meet the team</h2>
              <VideoPlayCard url={employer.intro_video_url} format="horizontal" />
            </div>
          )}

          {role.description && (
            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>About this role</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-text)' }}>{role.description}</p>
            </div>
          )}

          {role.required_skills?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>Skills required</h2>
              <div className="profile-tag-row">
                {role.required_skills.map((skill) => (
                  <span key={skill} className="tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {role.what_matters && (
            <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>What matters most: </strong>
              {role.what_matters}
            </p>
          )}

          {needsVideo && (
            <div
              className="card"
              style={{ marginTop: 20, padding: '16px 20px', background: '#fff4e5', border: 'none' }}
            >
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                Please add your profile video before applying. Employers want to meet you first.
              </p>
              <Link to="/profile/edit" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
                Add your profile video
              </Link>
            </div>
          )}

          {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>{applyButton}</div>
        </div>
      </div>
    </div>
  )
}
