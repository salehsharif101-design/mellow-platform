import { useMemo } from 'react'

const DAYS_SHOWN = 30

function buildDailyBuckets(applications) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    days.push({ date, key: date.toISOString().slice(0, 10), count: 0 })
  }
  const byKey = new Map(days.map((d) => [d.key, d]))
  applications.forEach((a) => {
    const key = new Date(a.applied_at).toISOString().slice(0, 10)
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
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Role page views</p>
          <p style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{views}</p>
        </div>
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Total applicants</p>
          <p style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{totalApplicants}</p>
        </div>
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>View → apply rate</p>
          <p style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{conversion !== null ? `${conversion}%` : '—'}</p>
        </div>
        {avgTimeToHireDays !== null && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Avg. time to hire</p>
            <p style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{avgTimeToHireDays}d</p>
          </div>
        )}
      </div>

      {totalApplicants > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 8 }}>
            Applications over the last {DAYS_SHOWN} days
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
            {dailyBuckets.map((d) => (
              <div
                key={d.key}
                title={`${d.date.toLocaleDateString()}: ${d.count} application${d.count === 1 ? '' : 's'}`}
                style={{
                  flex: 1,
                  height: `${Math.max(3, (d.count / maxCount) * 100)}%`,
                  background: d.count > 0 ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
