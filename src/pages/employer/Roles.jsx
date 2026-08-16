import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import EditRoleModal from '../../components/EditRoleModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import ShareButton from '../../components/ShareButton.jsx'

const STATUSES = ['open', 'paused', 'closed']
const STATUS_LABELS = { open: 'Open', paused: 'Paused', closed: 'Closed' }
const STATUS_COLORS = {
  open: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  paused: { background: '#fff4e5', color: '#b45309' },
  closed: { background: '#f2f2f2', color: 'var(--color-text-muted)' },
}

export default function EmployerRoles() {
  const { user } = useAuth()
  const [roles, setRoles] = useState([])
  const [applicationCounts, setApplicationCounts] = useState({})
  const [hasIntroVideo, setHasIntroVideo] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
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

    // Best-effort: the video nudge banner is non-critical, so a failure here
    // (e.g. the column not existing yet on an older schema) shouldn't block
    // the rest of the page from loading.
    supabase
      .from('employer_profiles')
      .select('intro_video_url')
      .eq('id', employer.id)
      .maybeSingle()
      .then(({ data }) => setHasIntroVideo(!!data?.intro_video_url))
      .catch(() => {})

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

  async function changeStatus(role, status) {
    if (status === role.status) return
    setUpdatingStatusId(role.id)
    const { data, error: updateError } = await supabase
      .from('roles')
      .update({ status })
      .eq('id', role.id)
      .select()
      .single()
    if (!updateError) {
      setRoles((prev) => prev.map((r) => (r.id === role.id ? data : r)))
    }
    setUpdatingStatusId(null)
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

      {roles.length > 0 && !hasIntroVideo && (
        <div
          className="card"
          style={{
            marginTop: 24,
            padding: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            background: 'var(--color-bg-soft)',
            border: 'none',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600 }}>Add a company video to get more applications</p>
          <Link to="/employer/profile/edit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            Add video
          </Link>
        </div>
      )}

      {roles.length === 0 ? (
        <EmptyState
          heading="No roles posted yet"
          body="Post your first role and start browsing real talent on video, not paper."
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
                    <span className="tag" style={STATUS_COLORS[role.status]}>
                      {STATUS_LABELS[role.status]}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {role.location} · {role.role_type[0].toUpperCase() + role.role_type.slice(1).replace('-', ' ')} · Posted{' '}
                    {new Date(role.created_at).toLocaleDateString()}
                  </p>
                  <Link
                    to={`/employer/roles/${role.id}/applicants`}
                    style={{ display: 'inline-block', marginTop: 6, fontSize: 14, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    {applicationCounts[role.id] || 0} applicant
                    {(applicationCounts[role.id] || 0) === 1 ? '' : 's'} →
                  </Link>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <ShareButton url={`https://beta.joinmellow.xyz/jobs/${role.slug}`} label="Share role" />
                  <a href={`/jobs/${role.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    View role
                  </a>
                  <select
                    className="input"
                    value={role.status}
                    disabled={updatingStatusId === role.id}
                    onChange={(e) => changeStatus(role, e.target.value)}
                    style={{ width: 'auto', padding: '8px 12px' }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
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
          message={`This will permanently delete all ${applicationCounts[deletingRole.id] || 0} application${
            applicationCounts[deletingRole.id] === 1 ? '' : 's'
          } submitted to it. This cannot be undone.`}
          onClose={() => setDeletingRole(null)}
          onConfirm={() => handleDelete(deletingRole)}
        />
      )}
    </div>
  )
}
