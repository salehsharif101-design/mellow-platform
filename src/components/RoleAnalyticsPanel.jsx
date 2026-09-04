import { useMemo } from 'react'

const DAYS_SHOWN = 30

const STAT_LABEL_STYLE = { fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }
// Matches the dashboard's own stat-card number styling (Dashboard.jsx hardcodes
// this same #005ef5, one shade of Mellow blue, rather than the CSS var).
const STAT_NUMBER_STYLE = { fontSize: 28, fontWeight: 700, marginTop: 4, color: '#005ef5' }

// .toISOString() always renders in UTC — for a bucket built from LOCAL
// midnight (below), that silently shifts the key back a day in any
// timezone ahead of UTC (Bahrain, this product's home market, is
// UTC+3). That shifted every bucket a day off from the date its own
// tooltip (built with the correct, local toLocaleDateString) displayed,
// and left "today" — whose real applications key off their own UTC date,
// not a shifted one — matching no bucket at all, so today's applications
// silently never showed up on the chart.
function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildDailyBuckets(applications) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    days.push({ date, key: localDateKey(date), count: 0 })
  }
  const byKey = new Map(days.map((d) => [d.key, d]))
  applications.forEach((a) => {
    const key = localDateKey(new Date(a.applied_at))
    const bucket = byKey.get(key)
    if (bucket) bucket.count += 1
  })
  return days
}

// Top-of-page analytics card on the role applicants page: views/applicants/
// conversion come straight off roles.view_count and the already-loaded
// applications list (no extra query), the 30-day chart buckets applied_at
// client-side, and average time to hire compares each hires.confirmed_at
// against that candidate's applied_at for this role — only shown once at
// least one hire is confirmed, per the spec, rather than as a misleading 0.
export default function RoleAnalyticsPanel({ role, applications, hires }) {
  const views = role.view_count || 0
  const totalApplicants = applications.length
  const conversion = views > 0 ? Math.round((totalApplicants / views) * 100) : null

  const avgTimeToHireDays = useMemo(() => {
    if (!hires || hires.length === 0) return null
    const diffs = hires
      .map((h) => {
        const app = applications.find((a) => a.candidate_profiles?.id === h.candidate_id)
        if (!app) return null
        return (new Date(h.confirmed_at).getTime() - new Date(app.applied_at).getTime()) / 86400000
      })
      .filter((d) => d !== null && d >= 0)
    if (diffs.length === 0) return null
    return Math.round((diffs.reduce((sum, d) => sum + d, 0) / diffs.length) * 10) / 10
  }, [hires, applications])

  const dailyBuckets = useMemo(() => buildDailyBuckets(applications), [applications])
  const maxCount = Math.max(1, ...dailyBuckets.map((d) => d.count))

  return (
    <div className="card" style={{ padding: 24, marginTop: 20 }}>
      <h2 style={{ fontSize: 16 }}>Role analytics</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginTop: 16 }}>
        <div>
          <p style={STAT_LABEL_STYLE}>Role page views</p>
          <p style={STAT_NUMBER_STYLE}>{views}</p>
        </div>
        <div>
          <p style={STAT_LABEL_STYLE}>Total applicants</p>
          <p style={STAT_NUMBER_STYLE}>{totalApplicants}</p>
        </div>
        <div>
          <p style={STAT_LABEL_STYLE}>View → apply rate</p>
          <p style={STAT_NUMBER_STYLE}>{conversion !== null ? `${conversion}%` : '—'}</p>
        </div>
        {avgTimeToHireDays !== null && (
          <div>
            <p style={STAT_LABEL_STYLE}>Avg. time to hire</p>
            <p style={STAT_NUMBER_STYLE}>{avgTimeToHireDays}d</p>
          </div>
        )}
      </div>

      {totalApplicants > 0 && (
        <div style={{ marginTop: 28 }}>
          <p style={{ ...STAT_LABEL_STYLE, marginBottom: 12 }}>Applications over the last {DAYS_SHOWN} days</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, borderBottom: '1px solid var(--color-border)' }}>
            {dailyBuckets.map((d) => (
              <div
                key={d.key}
                title={`${d.date.toLocaleDateString()}: ${d.count} application${d.count === 1 ? '' : 's'}`}
                style={{
                  flex: 1,
                  height: d.count > 0 ? `${Math.max(6, (d.count / maxCount) * 100)}%` : 2,
                  background: d.count > 0 ? '#005ef5' : 'var(--color-border)',
                  borderRadius: '2px 2px 0 0',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {dailyBuckets[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Today</span>
          </div>
        </div>
      )}
    </div>
  )
}
