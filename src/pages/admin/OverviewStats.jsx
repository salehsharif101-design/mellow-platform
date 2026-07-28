const LABELS = {
  totalCandidates: 'Total candidates',
  totalEmployers: 'Total employers',
  totalRoles: 'Roles posted',
  totalApplications: 'Applications',
  totalMessages: 'Messages sent',
}

export default function OverviewStats({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
      {Object.entries(LABELS).map(([key, label]) => (
        <div key={key} className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{label}</p>
          <p style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{stats[key] ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}
