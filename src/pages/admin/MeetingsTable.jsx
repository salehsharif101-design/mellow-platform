const OUTCOME_STYLES = {
  Hired: { background: '#e3f9e9', color: '#0f7a3d' },
  'Still in progress': { background: '#fff4d6', color: '#8a5a00' },
  'Pending follow-up': { background: '#f2f2f2', color: 'var(--color-text-muted)' },
}

export default function MeetingsTable({ data }) {
  const meetings = data.meetings || []

  return (
    <div>
      <div className="card" style={{ padding: 20, maxWidth: 220, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Total meetings booked</p>
        <p style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{data.total ?? 0}</p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--color-border)' }}>
              {['Employer', 'Candidate', 'Booked', 'Follow-up sent', 'Outcome'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.employerName || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.candidateName || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.bookedAt ? new Date(m.bookedAt).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    className="tag"
                    style={{ background: m.followUpSent ? '#e3f9e9' : '#f2f2f2', color: m.followUpSent ? '#0f7a3d' : 'var(--color-text-muted)' }}
                  >
                    {m.followUpSent ? 'Sent' : 'Not yet'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span className="tag" style={OUTCOME_STYLES[m.outcome] || OUTCOME_STYLES['Pending follow-up']}>
                    {m.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {meetings.length === 0 && <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>No meetings booked yet.</p>}
      </div>
    </div>
  )
}
