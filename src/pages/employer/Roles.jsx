import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import EditRoleModal from '../../components/EditRoleModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import EmptyState from '../../components/EmptyState.jsx'

export default function EmployerRoles() {
  const { user } = useAuth()
  const [roles, setRoles] = useState([])
  const [applicationCounts, setApplicationCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [deletingRole, setDeletingRole] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)
    const { data: employer, error: employerError } = await supabase
      .from('employer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (employerError) {
      setError(employerError.message)
      setLoading(false)
      return
    }
    if (!employer) {
      setLoading(false)
      return
    }

    const { data: myRoles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .eq('employer_id', employer.id)
      .order('created_at', { ascending: false })

    if (rolesError) {
      setError(rolesError.message)
      setLoading(false)
      return
    }
    setRoles(myRoles)

    const roleIds = myRoles.map((r) => r.id)
    if (roleIds.length > 0) {
      const { data: apps } = await supabase.from('applications').select('role_id').in('role_id', roleIds)
      const counts = {}
      ;(apps || []).forEach((a) => {
        counts[a.role_id] = (counts[a.role_id] || 0) + 1
      })
      setApplicationCounts(counts)
    }

    setLoading(false)
  }

  async function toggleActive(role) {
    setTogglingId(role.id)
    const { data, error: toggleError } = await supabase
      .from('roles')
      .update({ is_active: !role.is_active })
      .eq('id', role.id)
      .select()
      .single()
    if (!toggleError) {
      setRoles((prev) => prev.map((r) => (r.id === role.id ? data : r)))
    }
    setTogglingId(null)
  }

  async function handleDelete(role) {
    const { error: deleteError } = await supabase.from('roles').delete().eq('id', role.id)
    if (deleteError) throw deleteError
    setRoles((prev) => prev.filter((r) => r.id !== role.id))
    setDeletingRole(null)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Manage roles</h1>
        <Link to="/employer/roles/new" className="btn btn-primary">
          Post a new role
        </Link>
      </div>

      {roles.length === 0 ? (
        <EmptyState
          heading="No roles posted yet"
          body="Post your first role and start browsing real candidates on video, not paper."
          illustration="/Collaborate2.png"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28, maxWidth: 760 }}>
          {roles.map((role) => (
            <div key={role.id} className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontSize: 18 }}>{role.title}</h3>
                    <span
                      className="tag"
                      style={{
                        background: role.is_active ? 'var(--color-bg-soft)' : '#f2f2f2',
                        color: role.is_active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {role.is_active ? 'Active' : 'Closed'}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {role.location} · {role.role_type[0].toUpperCase() + role.role_type.slice(1).replace('-', ' ')} · Posted{' '}
                    {new Date(role.created_at).toLocaleDateString()}
                  </p>
                  <p style={{ fontSize: 14, marginTop: 6 }}>
                    <strong>{applicationCounts[role.id] || 0}</strong> application
                    {(applicationCounts[role.id] || 0) === 1 ? '' : 's'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={togglingId === role.id}
                    onClick={() => toggleActive(role)}
                  >
                    {role.is_active ? 'Close role' : 'Reopen role'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditingRole(role)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ color: '#d92d20', borderColor: '#d92d20' }}
                    onClick={() => setDeletingRole(role)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={(updated) => {
            setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            setEditingRole(null)
          }}
        />
      )}

      {deletingRole && (
        <ConfirmModal
          title="Delete this role?"
          message={`"${deletingRole.title}" will be permanently removed, along with any applications tied to it. This can't be undone.`}
          onClose={() => setDeletingRole(null)}
          onConfirm={() => handleDelete(deletingRole)}
        />
      )}
    </div>
  )
}
