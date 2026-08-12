import { useState } from 'react'
import { Link } from 'react-router-dom'
import { callAdminApi } from './adminApi.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'

export default function EmployersTable({ employers, setEmployers }) {
  const [deletingEmployer, setDeletingEmployer] = useState(null)

  async function toggleVisibility(employer) {
    const nextValue = !employer.isVisible
    setEmployers((prev) => prev.map((e) => (e.id === employer.id ? { ...e, isVisible: nextValue } : e)))
    try {
      await callAdminApi('toggle-employer-visibility', { employerId: employer.id, isVisible: nextValue })
    } catch (err) {
      // revert on failure
      setEmployers((prev) => prev.map((e) => (e.id === employer.id ? { ...e, isVisible: !nextValue } : e)))
      alert(`Failed to update: ${err.message}`)
    }
  }

  async function handleDelete(employer) {
    await callAdminApi('delete-user', { userId: employer.userId })
    setEmployers((prev) => prev.filter((e) => e.id !== employer.id))
    setDeletingEmployer(null)
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Company', 'Email', 'Joined', 'Roles posted', 'Messages sent', 'Visible', '', ''].map((h, i) => (
              <th key={i} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employers.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.companyName || '—'}</td>
              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{e.email || '—'}</td>
              <td style={{ padding: '10px 12px' }}>{e.dateJoined ? new Date(e.dateJoined).toLocaleDateString() : '—'}</td>
              <td style={{ padding: '10px 12px' }}>{e.rolesPosted}</td>
              <td style={{ padding: '10px 12px' }}>{e.messagesSent}</td>
              <td style={{ padding: '10px 12px' }}>
                <button
                  type="button"
                  onClick={() => toggleVisibility(e)}
                  className="tag"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: e.isVisible ? '#e3f9e9' : '#f2f2f2',
                    color: e.isVisible ? '#0f7a3d' : 'var(--color-text-muted)',
                  }}
                >
                  {e.isVisible ? 'Visible' : 'Hidden'}
                </button>
              </td>
              <td style={{ padding: '10px 12px' }}>
                {e.companySlug ? (
                  <Link to={`/company/${e.companySlug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    View →
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <button
                  type="button"
                  onClick={() => setDeletingEmployer(e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d92d20', fontWeight: 600 }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {employers.length === 0 && (
        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No employers yet.</p>
      )}

      {deletingEmployer && (
        <ConfirmModal
          title="Delete this employer?"
          message={`"${deletingEmployer.companyName || deletingEmployer.email}" will be permanently deleted, along with their roles, applications, and messages. This can't be undone.`}
          onClose={() => setDeletingEmployer(null)}
          onConfirm={() => handleDelete(deletingEmployer)}
        />
      )}
    </div>
  )
}
