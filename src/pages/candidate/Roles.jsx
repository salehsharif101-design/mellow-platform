import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'
import { formatDeadline, formatSalary } from '../../lib/roleFormat.js'
import EmptyState from '../../components/EmptyState.jsx'
import Modal from '../../components/Modal.jsx'
import VideoPlayCard from '../../components/VideoPlayCard.jsx'

export default function BrowseRoles() {
  const { user } = useAuth()

  const [candidateId, setCandidateId] = useState(null)
  const [roles, setRoles] = useState([])
  const [appliedRoleIds, setAppliedRoleIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyingId, setApplyingId] = useState(null)
  const [videoModalEmployer, setVideoModalEmployer] = useState(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select('id')
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

      const [{ data: activeRoles, error: rolesError }, { data: applications, error: applicationsError }] =
        await Promise.all([
          supabase
            .from('roles')
            .select(
              'id, title, location, role_type, description, what_matters, deadline, salary_min, salary_max, salary_currency, employer_profiles!inner(company_name, company_slug, industry, company_size, culture_description, company_highlight, logo_url, intro_video_url, is_visible)',
            )
            .eq('is_active', true)
            .eq('employer_profiles.is_visible', true)
            .order('created_at', { ascending: false }),
          supabase.from('applications').select('role_id').eq('candidate_id', candidate.id),
        ])

      if (rolesError) setError(rolesError.message)
      else setRoles(activeRoles)

      if (!applicationsError) setAppliedRoleIds(new Set(applications.map((a) => a.role_id)))

      setLoading(false)
    }

    load()
  }, [user])

  async function apply(roleId) {
    if (!candidateId) return
    setApplyingId(roleId)
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

  return (
    <div className="section">
      <h1 style={{ fontSize: 28 }}>Open roles</h1>

      {roles.length === 0 ? (
        <EmptyState
          heading="No open roles yet"
          body="New roles are added regularly. Make sure your profile is complete so employers can find you in the meantime."
          illustration="/Collaborate2.png"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28, maxWidth: 720 }}>
          {roles.map((role) => {
            const applied = appliedRoleIds.has(role.id)
            const employer = role.employer_profiles
            const culture = employer?.culture_description
            const cultureShort = culture && culture.length > 60 ? `${culture.slice(0, 60).trim()}…` : culture
            const deadlineLabel = formatDeadline(role.deadline)
            const salaryLabel = formatSalary(role)
            return (
              <div key={role.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    {employer?.logo_url && (
                      employer.company_slug ? (
                        <Link to={`/company/${employer.company_slug}`} style={{ flexShrink: 0 }}>
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
                          <Link to={`/company/${employer.company_slug}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
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
                            onClick={() => setVideoModalEmployer(employer)}
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
                  <button
                    type="button"
                    className={applied ? 'btn btn-ghost' : 'btn btn-primary'}
                    disabled={applied || applyingId === role.id}
                    onClick={() => apply(role.id)}
                    style={{ whiteSpace: 'nowrap', height: 'fit-content' }}
                  >
                    {applied ? 'Applied' : applyingId === role.id ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                <p style={{ marginTop: 14, fontSize: 15, color: 'var(--color-text-muted)' }}>{role.description}</p>
                {role.what_matters && (
                  <p style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>What matters most: </strong>
                    {role.what_matters}
                  </p>
                )}
              </div>
            )
          })}
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
