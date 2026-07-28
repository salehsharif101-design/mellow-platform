export default function RolesTable({ roles }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Title', 'Company', 'Posted', 'Status', 'Applications'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.title}</td>
              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{r.company || '—'}</td>
              <td style={{ padding: '10px 12px' }}>{new Date(r.datePosted).toLocaleDateString()}</td>
              <td style={{ padding: '10px 12px' }}>
                <span
                  className="tag"
                  style={{
                    background: r.isActive ? 'var(--color-bg-soft)' : '#f2f2f2',
                    color: r.isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {r.isActive ? 'Active' : 'Closed'}
                </span>
              </td>
              <td style={{ padding: '10px 12px' }}>{r.applicationCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {roles.length === 0 && <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No roles posted yet.</p>}
    </div>
  )
}
