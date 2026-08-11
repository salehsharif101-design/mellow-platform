import { useEffect, useState } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import { formatDeadline, formatSalary, formatResponseRate } from '../../lib/roleFormat.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROLE_SELECT =
  'id, title, location, role_type, description, what_matters, deadline, salary_min, salary_max, salary_currency, employer_profiles(company_name, company_slug, logo_url, linkedin_url, website_url, about, intro_video_url, user_id)'

export default function RolePublic() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, userType, loading: authLoading } = useAuth()

  const [role, setRole] = useState(null)
  const [redirectSlug, setRedirectSlug] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [candidateId, setCandidateId] = useState(null)
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [responseLabel, setResponseLabel] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error: roleError } = await supabase
        .from('roles')
        .select(ROLE_SELECT)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (data) {
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
        .select('id')
        .eq('candidate_id', candidate.id)
        .eq('role_id', role.id)
        .maybeSingle()

      if (existing) setApplied(true)
    }
    loadCandidate()
  }, [user, userType, role])

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
      notify('application-notification', { applicationId: data.id })
    }
    setApplying(false)
  }

  function handleCta() {
    if (!authLoading && user && userType === 'candidate') {
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

  const ctaLabel = applying
    ? 'Applying…'
    : applied
      ? 'Applied'
      : 'Apply with your Mellow video'

  return (
    <div className="section">
      <div className="card" style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {employer?.logo_url && (
            employer.company_slug ? (
              <Link to={`/company/${employer.company_slug}`}>
                <img
                  src={employer.logo_url}
                  alt=""
                  style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: 'var(--color-bg-soft)', flexShrink: 0 }}
                />
              </Link>
            ) : (
              <img
                src={employer.logo_url}
                alt=""
                style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: 'var(--color-bg-soft)', flexShrink: 0 }}
              />
            )
          )}
          <div>
            {employer?.company_name && (
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  companyName={employer.company_name}
                  size={15}
                />
              </p>
            )}
            <h1 style={{ fontSize: 26, marginTop: 2 }}>{role.title}</h1>
          </div>
        </div>

        {employer?.about && (
          <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{employer.about}</p>
        )}

        {responseLabel && (
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{responseLabel}</p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
          {role.location && <span className="tag">{role.location}</span>}
          <span className="tag">{roleTypeLabel}</span>
          {salaryLabel && <span className="tag">{salaryLabel}</span>}
          {deadlineLabel && <span className="tag">Apply by {deadlineLabel}</span>}
        </div>

        {employer?.intro_video_url && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Meet the team</h3>
            <VideoPlayCard url={employer.intro_video_url} format="horizontal" />
          </div>
        )}

        {role.description && (
          <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{role.description}</p>
        )}

        {role.what_matters && (
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>What matters most: </strong>
            {role.what_matters}
          </p>
        )}

        {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

        <button
          type="button"
          className={applied ? 'btn btn-ghost' : 'btn btn-primary'}
          disabled={applied || applying}
          onClick={handleCta}
          style={{ marginTop: 28, width: '100%' }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
