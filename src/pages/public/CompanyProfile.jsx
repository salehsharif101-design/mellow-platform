import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatDeadline, formatSalary, formatResponseRate } from '../../lib/roleFormat.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'

export default function CompanyProfile() {
  const { slug } = useParams()
  const { user } = useAuth()

  const [company, setCompany] = useState(null)
  const [roles, setRoles] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [responseLabel, setResponseLabel] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('employer_profiles')
        .select(
          'id, user_id, company_name, logo_url, industry, company_size, about, culture_description, company_highlight, typical_roles, linkedin_url, website_url, intro_video_url, is_visible',
        )
        .eq('company_slug', slug)
        .maybeSingle()

      if (error || !data || !data.is_visible) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setCompany(data)

      const { data: openRoles } = await supabase
        .from('roles')
        .select('id, slug, title, location, role_type, deadline, salary_min, salary_max, salary_currency')
        .eq('employer_id', data.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setRoles(openRoles || [])
      setLoading(false)

      const { data: rate } = await supabase
        .rpc('employer_avg_response_hours', { target_user_id: data.user_id })
        .maybeSingle()
      if (rate) setResponseLabel(formatResponseRate(rate.avg_hours, rate.response_count))
    }
    load()
  }, [slug])

  const isOwner = user && company && user.id === company.user_id

  async function shareProfile() {
    const url = `https://beta.joinmellow.xyz/company/${slug}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable or blocked (older browser, denied permission,
      // non-trusted context) — fall back to the legacy selection-based copy.
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (loading) return null

  if (notFound) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 32 }}>Company not found</h1>
        <p style={{ marginTop: 10, color: 'var(--color-text-muted)' }}>
          This company page may have moved or the link may be incorrect.
        </p>
      </div>
    )
  }

  const sizeLine = [company.industry, company.company_size && `${company.company_size} employees`]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="section">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt=""
                style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, background: 'var(--color-bg-soft)', flexShrink: 0 }}
              />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {company.company_name}
                  <CompanyLinkIcons
                    linkedinUrl={company.linkedin_url}
                    websiteUrl={company.website_url}
                    label={company.company_name}
                    size={17}
                  />
                </h1>
                {isOwner && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={shareProfile}
                  >
                    {linkCopied ? 'Link copied!' : 'Share profile'}
                  </button>
                )}
              </div>
              {sizeLine && <p style={{ marginTop: 4, fontSize: 14, color: 'var(--color-text-muted)' }}>{sizeLine}</p>}
              {responseLabel && (
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{responseLabel}</p>
              )}
            </div>
          </div>

          {company.about && (
            <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{company.about}</p>
          )}

          {company.culture_description && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Culture</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{company.culture_description}</p>
            </div>
          )}

          {company.company_highlight && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>What it's like to work here</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{company.company_highlight}</p>
            </div>
          )}

          {company.typical_roles && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Typically hiring for</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {company.typical_roles
                  .split(',')
                  .map((r) => r.trim())
                  .filter(Boolean)
                  .map((r) => (
                    <span key={r} className="tag" style={{ fontSize: 12 }}>
                      {r}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {company.intro_video_url && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Meet the team</h3>
              <VideoPlayCard url={company.intro_video_url} format="horizontal" />
            </div>
          )}
        </div>

        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>
            Open roles {roles.length > 0 && `(${roles.length})`}
          </h2>

          {roles.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>No open roles right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {roles.map((role) => {
                const roleTypeLabel = role.role_type[0].toUpperCase() + role.role_type.slice(1).replace('-', ' ')
                const deadlineLabel = formatDeadline(role.deadline)
                const salaryLabel = formatSalary(role)
                return (
                  <Link
                    key={role.id}
                    to={`/jobs/${role.slug}`}
                    className="card"
                    style={{ padding: 20, display: 'block', textDecoration: 'none', color: 'inherit' }}
                  >
                    <h3 style={{ fontSize: 17 }}>{role.title}</h3>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {role.location} · {roleTypeLabel}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
