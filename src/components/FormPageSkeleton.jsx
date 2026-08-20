// Placeholder for single-column form pages (e.g. post a role) on a
// genuinely cold load.
export default function FormPageSkeleton({ fields = 6 }) {
  return (
    <div className="section" aria-busy="true" aria-label="Loading">
      <div style={{ display: 'flex', gap: 48, maxWidth: 1000, margin: '0 auto', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div className="skeleton-block" style={{ width: 240, height: 32 }} />
          <div className="skeleton-block" style={{ width: 320, height: 16, marginTop: 14 }} />
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {Array.from({ length: fields }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
