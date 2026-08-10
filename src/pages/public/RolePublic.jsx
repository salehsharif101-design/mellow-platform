import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'

export default function RolePublic() {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const { user, userType, loading: authLoading } = useAuth()

  const [role, setRole] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [candidateId, setCandidateId] = useState(null)
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error: roleError } = await supabase
        .from('roles')
        .select('id, title, location, role_type, description, what_matters, employer_profiles(company_name, logo_url, linkedin_url)')
        .eq('id', roleId)
        .eq('is_active', true)
        .maybeSingle()

      if (roleError || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setRole(data)
      setLoading(false)
    }
    load()
  }, [roleId])

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
            <img
              src={employer.logo_url}
              alt=""
              style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: 'var(--color-bg-soft)', flexShrink: 0 }}
            />
          )}
          <div>
            {employer?.company_name && (
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {employer.company_name}
                {employer.linkedin_url && (
                  <a
                    href={employer.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${employer.company_name} on LinkedIn`}
                    style={{ display: 'inline-flex', lineHeight: 0 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#0A66C2">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
                    </svg>
                  </a>
                )}
              </p>
            )}
            <h1 style={{ fontSize: 26, marginTop: 2 }}>{role.title}</h1>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
          {role.location && <span className="tag">{role.location}</span>}
          <span className="tag">{roleTypeLabel}</span>
        </div>

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
