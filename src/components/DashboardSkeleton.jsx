// Placeholder shown only on a genuinely cold load (no cached dashboard data
// yet) — approximates the real layout so the page doesn't flash from blank
// to fully-populated. Roughly matches the shared shape of both the talent
// and employer dashboards: a title bar, a toggle/nudge card, a feed list,
// a row of stat cards, and a hero CTA banner.
export default function DashboardSkeleton() {
  return (
    <div className="section" aria-busy="true" aria-label="Loading dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div className="skeleton-block" style={{ width: 220, height: 32 }} />
        <div className="skeleton-block" style={{ width: 140, height: 40, borderRadius: 8 }} />
      </div>

      <div className="skeleton-block" style={{ marginTop: 24, height: 56, borderRadius: 12 }} />

      <div style={{ marginTop: 28 }}>
        <div className="skeleton-block" style={{ width: 120, height: 20, marginBottom: 14 }} />
        <div className="skeleton-block" style={{ height: 52, borderRadius: 12 }} />
      </div>

      <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-block" style={{ height: 84, borderRadius: 12 }} />
        ))}
      </div>

      <div className="skeleton-block" style={{ marginTop: 32, height: 100, borderRadius: 12 }} />
    </div>
  )
}
