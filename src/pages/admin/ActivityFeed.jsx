const TYPE_ICON = {
  signup: '👤',
  application: '📝',
  message: '💬',
}

export default function ActivityFeed({ events }) {
  if (events.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No activity yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((e, i) => (
        <div
          key={i}
          className="card"
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <span style={{ fontSize: 16 }}>{TYPE_ICON[e.type] || '•'}</span>
          <p style={{ fontSize: 14, flex: 1 }}>{e.description}</p>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {new Date(e.timestamp).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
