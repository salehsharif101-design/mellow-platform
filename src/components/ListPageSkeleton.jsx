// Placeholder for list/grid pages (talent feed, roles, team, applications,
// browse roles) on a genuinely cold load — approximates the page's real
// shape (a title bar plus a set of rows or cards) so it doesn't flash from
// blank to fully-populated.
export default function ListPageSkeleton({ titleWidth = 200, rows = 4, cards = false }) {
  return (
    <div className="section" aria-busy="true" aria-label="Loading">
      <div className="skeleton-block" style={{ width: titleWidth, height: 32 }} />

      {cards ? (
        <div
          style={{
            marginTop: 32,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ height: 280, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ height: 88, borderRadius: 12 }} />
          ))}
        </div>
      )}
    </div>
  )
}
