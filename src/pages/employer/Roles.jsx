import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { resolveEmployerId } from '../../lib/employerAccess.js'
import { getCachedPage, setCachedPage } from '../../lib/dashboardCache.js'
import EditRoleModal from '../../components/EditRoleModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import ShareButton from '../../components/ShareButton.jsx'
import IconButton from '../../components/IconButton.jsx'
import ListPageSkeleton from '../../components/ListPageSkeleton.jsx'

const STATUSES = ['open', 'paused', 'closed']
const STATUS_LABELS = { open: 'Open', paused: 'Paused', closed: 'Closed' }
const STATUS_COLORS = {
  open: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  paused: { background: '#fff4e5', color: '#b45309' },
  closed: { background: '#f2f2f2', color: 'var(--color-text-muted)' },
}

export default function EmployerRoles() {
  const { user } = useAuth()

  const cacheKey = user ? `roles:${user.id}` : null
  const cached = cacheKey ? getCachedPage(cacheKey) : null

  const [roles, setRoles] = useState(cached?.roles ?? [])
  const [applicationCounts, setApplicationCounts] = useState(cached?.applicationCounts ?? {})
  const [hasIntroVideo, setHasIntroVideo] = useState(cached?.hasIntroVideo ?? true)
  // Only a genuinely cold load (nothing cached yet from an earlier visit
  // this session) shows the skeleton — a return visit renders the cached
  // data immediately while load() quietly refreshes it in the background.
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [deletingRole, setDeletingRole] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    const { employerId } = await resolveEmployerId(user.id)
    if (!employerId) {
      setLoading(false)
      return
    }

    const [introResult, rolesResult] = await Promise.all([
      // Best-effort: the video nudge banner is non-critical, so a failure
      // here (e.g. the column not existing yet on an older schema)
      // shouldn't block the rest of the page from loading.
      supabase.from('employer_profiles').select('intro_video_url').eq('id', employerId).maybeSingle().then(
        (res) => res,
        () => ({ data: null }),
      ),
      supabase.from('roles').select('*').eq('employer_id', employerId).order('created_at', { ascending: false }),
    ])

    const hasIntro = !!introResult.data?.intro_video_url
    setHasIntroVideo(hasIntro)

    if (rolesResult.error) {
      setError(rolesResult.error.message)
      setLoading(false)
      return
    }
    const myRoles = rolesResult.data
    setRoles(myRoles)

    const roleIds = myRoles.map((r) => r.id)
    let counts = {}
    if (roleIds.length > 0) {
      const { data: apps } = await supabase.from('applications').select('role_id').in('role_id', roleIds)
      ;(apps || []).forEach((a) => {
        counts[a.role_id] = (counts[a.role_id] || 0) + 1
      })
      setApplicationCounts(counts)
    }

    setLoading(false)

    if (cacheKey) {
      setCachedPage(cacheKey, { roles: myRoles, applicationCounts: counts, hasIntroVideo: hasIntro })
    }
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

  if (loading) return <ListPageSkeleton titleWidth={180} rows={4} />

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
                  <ShareButton url={`https://beta.joinmellow.xyz/jobs/${role.slug}`} label="Share role" bordered />
                  <IconButton
                    href={`/jobs/${role.slug}`}
                    label="View role"
                    icon={
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    }
                  />
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
                  <IconButton
                    label="Edit role"
                    onClick={() => setEditingRole(role)}
                    icon={
                      <>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </>
                    }
                  />
                  <IconButton
                    label="Delete role"
                    variant="danger"
                    onClick={() => setDeletingRole(role)}
                    icon={
                      <>
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </>
                    }
                  />
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
