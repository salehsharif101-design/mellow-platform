import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { notify } from '../../lib/notify.js'

export default function BrowseRoles() {
  const { user } = useAuth()

  const [candidateId, setCandidateId] = useState(null)
  const [roles, setRoles] = useState([])
  const [appliedRoleIds, setAppliedRoleIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyingId, setApplyingId] = useState(null)

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
            .select('id, title, location, role_type, description, what_matters, employer_profiles(company_name)')
            .eq('is_active', true)
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
        <p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>No open roles right now — check back soon.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28, maxWidth: 720 }}>
          {roles.map((role) => {
            const applied = appliedRoleIds.has(role.id)
            return (
              <div key={role.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: 19 }}>{role.title}</h3>
                    <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {role.employer_profiles?.company_name} · {role.location} ·{' '}
                      {role.role_type[0].toUpperCase() + role.role_type.slice(1).replace('-', ' ')}
                    </p>
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
    </div>
  )
}
