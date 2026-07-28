export default function EmployersTable({ employers }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
            {['Company', 'Email', 'Joined', 'Roles posted', 'Messages sent'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
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
            </tr>
          ))}
        </tbody>
      </table>
      {employers.length === 0 && (
        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No employers yet.</p>
      )}
    </div>
  )
}
