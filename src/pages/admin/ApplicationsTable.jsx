import { Link } from 'react-router-dom'

const STATUS_COLORS = {
  applied: { background: 'var(--color-bg-soft)', color: 'var(--color-primary)' },
  shortlisted: { background: '#fff6e0', color: '#8a6100' },
  contacted: { background: '#eae5ff', color: '#5b3df0' },
  hired: { background: '#e3f9e9', color: '#0f7a3d' },
}

export default function ApplicationsTable({ applications }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Candidate', 'Role', 'Company', 'Status', 'Applied', ''].map((h, i) => (
              <th key={i} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.candidateName || '—'}</td>
              <td style={{ padding: '10px 12px' }}>{a.roleTitle || '—'}</td>
              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{a.companyName || '—'}</td>
              <td style={{ padding: '10px 12px' }}>
                <span className="tag" style={{ ...(STATUS_COLORS[a.status] || STATUS_COLORS.applied), textTransform: 'capitalize' }}>
                  {a.status}
                </span>
              </td>
              <td style={{ padding: '10px 12px' }}>{a.appliedAt ? new Date(a.appliedAt).toLocaleDateString() : '—'}</td>
              <td style={{ padding: '10px 12px', display: 'flex', gap: 12 }}>
                {a.candidateUsername && (
                  <Link to={`/profile/${a.candidateUsername}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    Candidate →
                  </Link>
                )}
                {a.roleSlug && (
                  <Link to={`/jobs/${a.roleSlug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    Role →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {applications.length === 0 && (
        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No applications yet.</p>
      )}
    </div>
  )
}
