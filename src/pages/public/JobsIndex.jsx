import { Link } from 'react-router-dom'
import { useSeoMeta } from '../../lib/useSeoMeta.js'
import { JOBS_LOCATIONS } from '../../lib/seoContent.js'

export default function JobsIndex() {
  useSeoMeta({
    title: 'Find Jobs in the GCC | Mellow',
    description: 'Browse open roles across Bahrain, the UAE, and Saudi Arabia on Mellow — apply with a 60-second video instead of a CV.',
  })

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32 }}>Find your next role in the GCC</h1>
        <p style={{ marginTop: 12, fontSize: 16, color: 'var(--color-text-muted)', maxWidth: 600 }}>
          Browse open roles by location. Apply once with a video, and employers meet the real you before the
          first interview.
        </p>

        <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(JOBS_LOCATIONS).map(([slug, loc]) => (
            <Link
              key={slug}
              to={`/jobs/${slug}`}
              className="card stat-card-link"
              style={{ padding: '14px 22px', fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}
            >
              Jobs in {loc.name}
            </Link>
          ))}
        </div>

        <div className="card" style={{ marginTop: 40, padding: 24, textAlign: 'center', background: 'var(--color-bg-soft)', border: 'none' }}>
          <h2 style={{ fontSize: 18 }}>Ready to apply with video, not paper?</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Sign up free and record your profile once — it goes to every role you apply to.
          </p>
          <a
            href="https://beta.joinmellow.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 14, display: 'inline-block' }}
          >
            Get started on Mellow
          </a>
        </div>
      </div>
    </div>
  )
}
