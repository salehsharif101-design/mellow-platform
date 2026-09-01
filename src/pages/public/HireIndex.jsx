import { Link } from 'react-router-dom'
import { useSeoMeta } from '../../lib/useSeoMeta.js'
import { HIRE_LOCATIONS, HIRE_ROLES, HIRE_LOCATION_ROLES } from '../../lib/seoContent.js'

export default function HireIndex() {
  useSeoMeta({
    title: 'Hire Talent in the GCC | Mellow',
    description:
      'Hire video editors, graphic designers, marketing managers, and more across Bahrain, the UAE, and Saudi Arabia — browse video profiles on Mellow instead of screening CVs.',
  })

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32 }}>Hire talent across the GCC</h1>
        <p style={{ marginTop: 12, fontSize: 16, color: 'var(--color-text-muted)', maxWidth: 600 }}>
          Browse candidates by role and location. Every Mellow profile starts with a 60-second video, so you meet
          the person before you ever read a resume.
        </p>

        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 32 }}>
          {Object.entries(HIRE_LOCATION_ROLES).map(([location, roles]) => (
            <div key={location}>
              <h2 style={{ fontSize: 20 }}>{HIRE_LOCATIONS[location].name}</h2>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {roles.map((role) => (
                  <Link
                    key={role}
                    to={`/hire/${location}/${role}`}
                    className="card stat-card-link"
                    style={{ padding: '10px 16px', fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}
                  >
                    Hire {HIRE_ROLES[role].plural} {HIRE_LOCATIONS[location].locationLabel}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 40, padding: 24, textAlign: 'center', background: 'var(--color-bg-soft)', border: 'none' }}>
          <h2 style={{ fontSize: 18 }}>Don't see your role or location?</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Mellow is open to employers everywhere — post any role and start browsing talent today.
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
