import { useParams, Link } from 'react-router-dom'
import { useSeoMeta } from '../../lib/useSeoMeta.js'
import { getHirePage, HIRE_BENEFITS } from '../../lib/seoContent.js'

export default function HireLocationRole() {
  const { location, role } = useParams()
  const page = getHirePage(location, role)

  useSeoMeta(
    page
      ? {
          title: `Hire ${page.roleInfo.plural} in ${page.loc.name} | Mellow`,
          description: `Hire ${page.roleInfo.plural.toLowerCase()} ${page.loc.locationLabel} on Mellow. Watch 60-second video profiles, skip the CV pile, and pay only when you hire.`,
        }
      : { title: 'Hire on Mellow' },
  )

  if (!page) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Page not found</h1>
        <p style={{ marginTop: 10, color: 'var(--color-text-muted)' }}>
          We don't have a page for that combination yet. <Link to="/hire">See all hiring locations →</Link>
        </p>
      </div>
    )
  }

  const { loc, roleInfo } = page

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p className="eyebrow" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Hiring {loc.locationLabel}
        </p>
        <h1 style={{ marginTop: 10, fontSize: 36 }}>
          Hire {roleInfo.plural} {loc.locationLabel}
        </h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)', maxWidth: 640 }}>
          Mellow makes it fast to hire {roleInfo.plural.toLowerCase()} {loc.locationLabel}. Post a role, browse a
          feed of real candidates who introduce themselves on video, and reach out directly to the ones you want
          to talk to — no CVs, no cover letters, no weeks of screening before the first real conversation.{' '}
          {roleInfo.tagline}
        </p>
        <a
          href="https://beta.joinmellow.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ marginTop: 24, display: 'inline-block', fontSize: 15, padding: '12px 28px' }}
        >
          Start hiring on Mellow
        </a>

        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 22 }}>Why hire {roleInfo.plural.toLowerCase()} on Mellow</h2>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {HIRE_BENEFITS.map((benefit) => (
              <div key={benefit} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: '#0f7a3d', fontWeight: 700, flexShrink: 0 }}>
                  ✓
                </span>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 40, padding: 28, textAlign: 'center', background: 'var(--color-bg-soft)', border: 'none' }}>
          <h2 style={{ fontSize: 20 }}>Ready to hire {roleInfo.singular}?</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Free to get started. No cost until you make a hire.
          </p>
          <a
            href="https://beta.joinmellow.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 16, display: 'inline-block' }}
          >
            Get started on Mellow
          </a>
        </div>

        <p style={{ marginTop: 32, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Link to="/hire" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            See all hiring locations and roles →
          </Link>
        </p>
      </div>
    </div>
  )
}
