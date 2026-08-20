// Placeholder for the two-pane messages layout (conversation list + thread)
// on a genuinely cold load.
export default function MessagesSkeleton() {
  return (
    <div className="section" aria-busy="true" aria-label="Loading messages">
      <div className="skeleton-block" style={{ width: 140, height: 32 }} />
      <div style={{ display: 'flex', gap: 32, marginTop: 28, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-block" style={{ height: 58, borderRadius: 12 }} />
          ))}
        </div>
        <div className="skeleton-block" style={{ flex: 1, maxWidth: 480, height: 320, borderRadius: 12 }} />
      </div>
    </div>
  )
}
