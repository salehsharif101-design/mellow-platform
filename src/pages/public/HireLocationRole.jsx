import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSeoMeta } from '../../lib/useSeoMeta.js'
import { getHirePage, HIRE_BENEFITS, JOBS_LOCATIONS } from '../../lib/seoContent.js'
import { roleTitleToSlug, slugToLabel } from '../../lib/roleTypeSlug.js'
import { supabase } from '../../lib/supabase.js'
import { formatSalary } from '../../lib/roleFormat.js'

// A page only gets full dynamic content once 2+ active roles share this
// role-type slug in this location — below that a single stray posting
// would make for a thin, not-really-a-category SEO page.
const MIN_ACTIVE_ROLES = 2

export default function HireLocationRole() {
  const { location, role } = useParams()
  const page = getHirePage(location, role)
  // Same three countries the static pages and /jobs/:location already
  // support — the dynamic system covers new role types, not new locations.
  const loc = JOBS_LOCATIONS[location]

  // null = still loading, array = loaded. Only queried for the dynamic
  // path — a valid static `page` never touches the network.
  const [dynamicRoles, setDynamicRoles] = useState(null)

  useEffect(() => {
    if (page || !loc) return
    let cancelled = false
    setDynamicRoles(null)
    async function load() {
      const orFilter = loc.matchTerms.map((term) => `location.ilike.%${term}%`).join(',')
      const { data } = await supabase
        .from('roles')
        .select('id, slug, title, location, salary_min, salary_max, salary_currency, employer_profiles(company_name)')
        .eq('is_active', true)
        .or(orFilter)
        .order('created_at', { ascending: false })
      const matching = (data || []).filter((r) => roleTitleToSlug(r.title) === role)
      if (!cancelled) setDynamicRoles(matching)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, loc, location, role])

  const dynamicLabel = slugToLabel(role)
  const dynamicLoading = !page && Boolean(loc) && dynamicRoles === null
  const dynamicHasEnough = !page && Boolean(loc) && dynamicRoles !== null && dynamicRoles.length >= MIN_ACTIVE_ROLES

  useSeoMeta(
    page
      ? {
          title: `Hire ${page.roleInfo.plural} in ${page.loc.name} | Mellow`,
          description: `Hire ${page.roleInfo.plural.toLowerCase()} ${page.loc.locationLabel} on Mellow. Watch 60-second video profiles and skip the CV pile.`,
        }
      : dynamicHasEnough
        ? {
            title: `Hire ${dynamicLabel} ${loc.locationLabel} | Mellow`,
            description: `Hire ${dynamicLabel.toLowerCase()} ${loc.locationLabel} on Mellow. Watch 60-second video profiles and skip the CV pile.`,
          }
        : { title: 'Hire on Mellow' },
  )

  if (!page && !loc) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Page not found</h1>
        <p style={{ marginTop: 10, color: 'var(--color-text-muted)' }}>
          We don't have a page for that combination yet. <Link to="/hire">See all hiring locations →</Link>
        </p>
      </div>
    )
  }

  if (page) {
    const { loc: pageLoc, roleInfo } = page
    return (
      <div className="section">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p className="eyebrow" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            Hiring {pageLoc.locationLabel}
          </p>
          <h1 style={{ marginTop: 10, fontSize: 36 }}>
            Hire {roleInfo.plural} {pageLoc.locationLabel}
          </h1>
          <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)', maxWidth: 640 }}>
            Mellow makes it fast to hire {roleInfo.plural.toLowerCase()} {pageLoc.locationLabel}. Post a role, browse a
            feed of real candidates who introduce themselves on video, and reach out directly to the ones you want
            to talk to, no CVs, no cover letters, no weeks of screening before the first real conversation.{' '}
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
              Post a role and start browsing real candidates today.
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

  if (dynamicLoading) {
    return <div className="section" />
  }

  if (!dynamicHasEnough) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <p className="eyebrow" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            Hiring {loc.locationLabel}
          </p>
          <h1 style={{ marginTop: 10, fontSize: 30 }}>
            Hire {dynamicLabel} {loc.locationLabel}
          </h1>
          <p style={{ marginTop: 16, fontSize: 15, color: 'var(--color-text-muted)' }}>
            No current openings for {dynamicLabel.toLowerCase()} {loc.locationLabel} yet. Sign up and be the
            first to post one, or check back soon.
          </p>
          <a
            href="https://beta.joinmellow.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 20, display: 'inline-block' }}
          >
            Get started on Mellow
          </a>
          <p style={{ marginTop: 32, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <Link to="/hire" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              See all hiring locations and roles →
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p className="eyebrow" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Hiring {loc.locationLabel}
        </p>
        <h1 style={{ marginTop: 10, fontSize: 36 }}>
          Hire {dynamicLabel} {loc.locationLabel}
        </h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)', maxWidth: 640 }}>
          Mellow makes it fast to hire {dynamicLabel.toLowerCase()} {loc.locationLabel}. Post a role, browse a feed
          of real candidates who introduce themselves on video, and reach out directly to the ones you want to talk
          to, no CVs, no cover letters, no weeks of screening before the first real conversation.
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
          <h2 style={{ fontSize: 22 }}>
            Open {dynamicLabel.toLowerCase()} roles {loc.locationLabel}
          </h2>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dynamicRoles.map((r) => (
              <Link key={r.id} to={`/jobs/${r.slug}`} className="card stat-card-link" style={{ padding: 16, display: 'block' }}>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {r.employer_profiles?.company_name} · {r.location}
                </p>
                {formatSalary(r) && (
                  <span className="tag" style={{ fontSize: 12, marginTop: 8, display: 'inline-block' }}>
                    {formatSalary(r)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 22 }}>Why hire on Mellow</h2>
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
          <h2 style={{ fontSize: 20 }}>Ready to hire {dynamicLabel.toLowerCase()}?</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Post a role and start browsing real candidates today.
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
