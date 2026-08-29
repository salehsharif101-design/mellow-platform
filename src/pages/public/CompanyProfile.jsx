import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDeadline, formatSalary, formatResponseRate } from '../../lib/roleFormat.js'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'
import CompanyLinkIcons from '../../components/CompanyLinkIcons.jsx'
import ShareButton from '../../components/ShareButton.jsx'

const SECTION_TITLE_STYLE = { fontSize: 20, marginBottom: 16 }

export default function CompanyProfile() {
  const { slug } = useParams()
  const { user, userType } = useAuth()

  const [company, setCompany] = useState(null)
  const [roles, setRoles] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [responseLabel, setResponseLabel] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('employer_profiles')
        .select(
          'id, user_id, company_name, logo_url, industry, company_size, headline, about, culture_description, company_highlight, typical_roles, linkedin_url, website_url, intro_video_url, is_visible',
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

  useEffect(() => {
    // Only talent visits count toward "who viewed your company profile" —
    // an employer previewing their own page (or another company's) shouldn't.
    if (!company || !user || userType !== 'candidate') return
    supabase.from('company_views').insert({ employer_id: company.id, viewer_id: user.id })
  }, [company, user, userType])

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

  const typicalRoles = (company.typical_roles || '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="profile-card">
          <div className="profile-hero-avatar-row">
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt=""
                style={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 12, background: 'var(--color-bg-soft)', flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 28 }}>{company.company_name}</h1>
                <CompanyLinkIcons
                  linkedinUrl={company.linkedin_url}
                  websiteUrl={company.website_url}
                  label={company.company_name}
                  size={15}
                />
                <ShareButton url={`https://beta.joinmellow.xyz/company/${slug}`} label="Share profile" />
              </div>
              {sizeLine && (
                <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>{sizeLine}</p>
              )}
              {company.headline && (
                <p style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>
                  {company.headline}
                </p>
              )}
            </div>
          </div>

          {company.intro_video_url && (
            <div style={{ marginTop: 32 }}>
              <h2 style={SECTION_TITLE_STYLE}>Meet the team</h2>
              <VideoPlayCard url={company.intro_video_url} format="auto" style={{ width: '100%' }} />
            </div>
          )}

          {company.about && (
            <div style={{ marginTop: 32 }}>
              <h2 style={SECTION_TITLE_STYLE}>About</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-text)' }}>{company.about}</p>
            </div>
          )}

          {company.culture_description && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Culture</h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{company.culture_description}</p>
            </div>
          )}

          {company.company_highlight && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>What it's like to work here</h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{company.company_highlight}</p>
            </div>
          )}

          {typicalRoles.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Typically hiring for</h3>
              <div className="profile-tag-row">
                {typicalRoles.map((r) => (
                  <span key={r} className="tag">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {responseLabel && (
            <div style={{ marginTop: 28 }}>
              <span className="tag" style={{ fontSize: 12, fontWeight: 600, background: '#e3f9e9', color: '#0f7a3d' }}>
                {responseLabel}
              </span>
            </div>
          )}
        </div>

        <div className="profile-card">
          <h2 style={SECTION_TITLE_STYLE}>
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
                    className="card stat-card-link"
                    style={{ padding: 20, display: 'block' }}
                  >
                    <h3 style={{ fontSize: 17 }}>{role.title}</h3>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {role.location} · {roleTypeLabel}
                    </p>
                    <div className="profile-tag-row" style={{ marginTop: 8 }}>
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
