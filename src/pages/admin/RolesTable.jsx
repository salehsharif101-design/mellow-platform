import { useState } from 'react'
import { Link } from 'react-router-dom'
import { callAdminApi } from './adminApi.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'

const STATUS_LABELS = { open: 'Open', paused: 'Paused', closed: 'Closed' }
const STATUS_COLORS = {
  open: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  paused: { background: '#fff4e5', color: '#b45309' },
  closed: { background: '#f2f2f2', color: 'var(--color-text-muted)' },
}

export default function RolesTable({ roles, setRoles }) {
  const [closingId, setClosingId] = useState(null)
  const [deletingRole, setDeletingRole] = useState(null)

  async function closeRole(role) {
    setClosingId(role.id)
    try {
      await callAdminApi('close-role', { roleId: role.id })
      setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, status: 'closed', isActive: false } : r)))
    } catch (err) {
      alert(`Failed to close role: ${err.message}`)
    } finally {
      setClosingId(null)
    }
  }

  async function handleDelete(role) {
    await callAdminApi('delete-role', { roleId: role.id })
    setRoles((prev) => prev.filter((r) => r.id !== role.id))
    setDeletingRole(null)
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Title', 'Company', 'Posted', 'Status', 'Applications', '', '', ''].map((h, i) => (
              <th key={i} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => {
            const status = r.status || (r.isActive ? 'open' : 'closed')
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.title}</td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{r.company || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{new Date(r.datePosted).toLocaleDateString()}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span className="tag" style={STATUS_COLORS[status]}>
                    {STATUS_LABELS[status] || status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>{r.applicationCount}</td>
                <td style={{ padding: '10px 12px' }}>
                  {r.slug ? (
                    <Link to={`/jobs/${r.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                      View →
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => closeRole(r)}
                      disabled={closingId === r.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}
                    >
                      {closingId === r.id ? 'Closing…' : 'Close'}
                    </button>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button
                    type="button"
                    onClick={() => setDeletingRole(r)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d92d20', fontWeight: 600 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {roles.length === 0 && <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No roles posted yet.</p>}

      {deletingRole && (
        <ConfirmModal
          title="Delete this role?"
          message={`"${deletingRole.title}" will be permanently deleted, along with any applications tied to it. This can't be undone.`}
          onClose={() => setDeletingRole(null)}
          onConfirm={() => handleDelete(deletingRole)}
        />
      )}
    </div>
  )
}
